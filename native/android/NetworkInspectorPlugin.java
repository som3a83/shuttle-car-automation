package com.shuttlecar.automation;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.DhcpInfo;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.provider.Settings;
import android.text.format.Formatter;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "NetworkInspector", permissions = {
    @Permission(alias = "wifi", strings = { Manifest.permission.ACCESS_FINE_LOCATION, "android.permission.NEARBY_WIFI_DEVICES" })
})
public class NetworkInspectorPlugin extends Plugin {
    @PluginMethod public void requestWifiPermission(PluginCall call) {
        requestPermissionForAlias("wifi", call, "wifiPermissionCallback");
    }
    @PermissionCallback private void wifiPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState("wifi") == com.getcapacitor.PermissionState.GRANTED);
        call.resolve(result);
    }
    @PluginMethod public void openWifiSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Build.VERSION.SDK_INT >= 29 ? Settings.Panel.ACTION_WIFI : Settings.ACTION_WIFI_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(intent); call.resolve();
        } catch (Exception error) { call.reject("Could not open Wi-Fi settings", error); }
    }
    @PluginMethod public void openBluetoothSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(intent); call.resolve();
        } catch (Exception error) { call.reject("Could not open Bluetooth settings", error); }
    }
    @PluginMethod public void getWifiInfo(PluginCall call) {
        if (getPermissionState("wifi") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Wi-Fi location permission is required", "PERMISSION_REQUIRED"); return;
        }
        try {
            WifiManager manager = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            WifiInfo info = manager == null ? null : manager.getConnectionInfo();
            DhcpInfo dhcp = manager == null ? null : manager.getDhcpInfo();
            boolean connected = info != null && info.getNetworkId() != -1 && info.getIpAddress() != 0;
            JSObject result = new JSObject();
            result.put("connected", connected);
            result.put("ssid", connected ? cleanSsid(info.getSSID()) : "");
            result.put("bssid", connected ? safe(info.getBSSID()) : "");
            result.put("ipAddress", connected ? Formatter.formatIpAddress(info.getIpAddress()) : "");
            result.put("linkSpeedMbps", connected ? info.getLinkSpeed() : 0);
            result.put("frequencyMhz", connected && Build.VERSION.SDK_INT >= 21 ? info.getFrequency() : 0);
            result.put("gateway", dhcp == null ? "" : Formatter.formatIpAddress(dhcp.gateway));
            result.put("subnetMask", dhcp == null ? "" : Formatter.formatIpAddress(dhcp.netmask));
            result.put("macAddress", "Unavailable: Android restricts access to device MAC addresses");
            call.resolve(result);
        } catch (SecurityException error) { call.reject("Android denied access to Wi-Fi details. Grant required permissions.", error); }
        catch (Exception error) { call.reject("Could not read current Wi-Fi connection", error); }
    }
    @PluginMethod public void scanWifiNetworks(PluginCall call) {
        if (getPermissionState("wifi") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Wi-Fi location permission is required", "PERMISSION_REQUIRED"); return;
        }
        try {
            WifiManager manager = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (manager == null || !manager.isWifiEnabled()) { call.reject("Wi-Fi is disabled. Enable it in Android settings first.", "WIFI_DISABLED"); return; }
            manager.startScan();
            List<ScanResult> results = manager.getScanResults();
            JSArray networks = new JSArray();
            for (ScanResult item : results) {
                JSObject network = new JSObject();
                network.put("ssid", item.SSID == null || item.SSID.isEmpty() ? "(Hidden network)" : item.SSID);
                network.put("bssid", safe(item.BSSID)); network.put("security", safe(item.capabilities));
                network.put("levelDbm", item.level); network.put("frequencyMhz", item.frequency); networks.put(network);
            }
            JSObject result = new JSObject(); result.put("networks", networks); result.put("count", networks.length());
            result.put("note", "Android may throttle scans and return cached results."); call.resolve(result);
        } catch (SecurityException error) { call.reject("Android denied Wi-Fi scan access. Check Location permission and Location services.", error); }
        catch (Exception error) { call.reject("Wi-Fi scan failed", error); }
    }
    @PluginMethod public void scanLocalNetwork(PluginCall call) {
        if (getPermissionState("wifi") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Wi-Fi location permission is required", "PERMISSION_REQUIRED"); return;
        }
        ExecutorService worker = Executors.newSingleThreadExecutor();
        worker.execute(() -> {
            try {
                WifiManager manager = (WifiManager) getContext().getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                DhcpInfo dhcp = manager == null ? null : manager.getDhcpInfo();
                if (dhcp == null || dhcp.ipAddress == 0 || dhcp.netmask == 0) { call.reject("No active Wi-Fi IPv4 subnet was found."); return; }
                int ip = dhcp.ipAddress, mask = dhcp.netmask, network = ip & mask;
                int prefix = Integer.bitCount(mask);
                if (prefix < 24) network = ip & 0x00FFFFFF; // never sweep a routed network larger than /24
                final int base = network;
                ExecutorService pool = Executors.newFixedThreadPool(24);
                List<JSObject> found = Collections.synchronizedList(new ArrayList<>());
                CountDownLatch latch = new CountDownLatch(254);
                for (int host = 1; host <= 254; host++) {
                    final int address = base | (host << 24);
                    pool.execute(() -> {
                        try {
                            String ipText = Formatter.formatIpAddress(address);
                            InetAddress target = InetAddress.getByName(ipText);
                            boolean alive = target.isReachable(260);
                            JSArray ports = new JSArray();
                            int[] candidates = new int[] {80, 443, 502, 1883, 4840, 8080};
                            for (int port : candidates) {
                                try (Socket socket = new Socket()) {
                                    socket.connect(new InetSocketAddress(target, port), 180); ports.put(port);
                                } catch (Exception ignored) { }
                            }
                            if (alive || ports.length() > 0) {
                                JSObject device = new JSObject(); device.put("ipAddress", ipText);
                                device.put("hostName", safe(target.getCanonicalHostName()));
                                device.put("reachable", alive); device.put("openPorts", ports);
                                device.put("macAddress", "Unavailable on modern Android without privileged access");
                                found.add(device);
                            }
                        } catch (Exception ignored) { } finally { latch.countDown(); }
                    });
                }
                latch.await(22, TimeUnit.SECONDS); pool.shutdownNow();
                found.sort(Comparator.comparing(item -> item.optString("ipAddress")));
                JSArray devices = new JSArray(); for (JSObject device : found) devices.put(device);
                JSObject result = new JSObject(); result.put("devices", devices); result.put("count", devices.length());
                result.put("subnet", Formatter.formatIpAddress(dhcp.ipAddress) + "/" + prefix);
                result.put("scope", "Current Wi-Fi LAN segment only");
                result.put("note", "Best-effort discovery. Firewalls, client isolation and Android restrictions can hide devices.");
                call.resolve(result);
            } catch (Exception error) { call.reject("Local network discovery failed", error); }
            finally { worker.shutdown(); }
        });
    }
    private static String cleanSsid(String value) {
        if (value == null || value.equals("<unknown ssid>")) return "";
        return value.replace("\"", "");
    }
    private static String safe(String value) { return value == null ? "" : value; }
}