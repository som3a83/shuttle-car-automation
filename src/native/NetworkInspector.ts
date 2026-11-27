import { registerPlugin } from '@capacitor/core';
export interface WifiNetwork { ssid:string; bssid:string; security:string; levelDbm:number; frequencyMhz:number; }
export interface WifiInfo { connected:boolean; ssid:string; bssid:string; ipAddress:string; linkSpeedMbps:number; frequencyMhz:number; gateway:string; subnetMask:string; macAddress:string; }
export interface LanDevice { ipAddress:string; hostName:string; reachable:boolean; openPorts:number[]; macAddress:string; }
export interface NetworkInspectorPlugin {
 requestWifiPermission():Promise<{granted:boolean}>; openWifiSettings():Promise<void>; openBluetoothSettings():Promise<void>;
 getWifiInfo():Promise<WifiInfo>; scanWifiNetworks():Promise<{networks:WifiNetwork[];count:number;note:string}>;
 scanLocalNetwork():Promise<{devices:LanDevice[];count:number;subnet:string;scope:string;note:string}>;
}
export const NetworkInspector=registerPlugin<NetworkInspectorPlugin>('NetworkInspector');
