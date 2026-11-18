import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  BleClient,
  type BleDevice,
  type BleService,
  type BleCharacteristic
} from '@capacitor-community/bluetooth-le';
import './BleReadOnlyExplorer.css';

interface DiscoveredBleDevice {
  device: BleDevice;
  rssi?: number;
  localName?: string;
}

function rawValue(value: DataView): string {
  const bytes = Array.from({ length: value.byteLength }, (_, index) => value.getUint8(index));
  if (bytes.length === 0) return 'EMPTY';
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ').toUpperCase();
}

/**
 * Generic Bluetooth Low Energy GATT explorer.
 *
 * It deliberately exposes no write/command API. A raw characteristic value is
 * not treated as shuttle telemetry until a vendor-specific decoder and approved
 * tag mapping have been commissioned.
 */
export default function BleReadOnlyExplorer({ language = 'ar' }: { language?: 'ar' | 'en' }) {
  const ar = language === 'ar';
  const [devices, setDevices] = useState<DiscoveredBleDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BleDevice | null>(null);
  const [services, setServices] = useState<BleService[]>([]);
  const [serviceUuid, setServiceUuid] = useState('');
  const [characteristicUuid, setCharacteristicUuid] = useState('');
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [reading, setReading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [lastValue, setLastValue] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const scanTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationRef = useRef<{ service: string; characteristic: string } | null>(null);
  const deviceRef = useRef<BleDevice | null>(null);

  const t = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar]);

  const selectedService = useMemo(
    () => services.find((service) => service.uuid === serviceUuid),
    [services, serviceUuid]
  );

  const readableCharacteristics = useMemo(
    () => selectedService?.characteristics.filter((item) => item.properties.read || item.properties.notify || item.properties.indicate) || [],
    [selectedService]
  );

  const selectedCharacteristic = useMemo(
    () => readableCharacteristics.find((item) => item.uuid === characteristicUuid),
    [readableCharacteristics, characteristicUuid]
  );

  const stopNotification = useCallback(async () => {
    const active = notificationRef.current;
    const device = deviceRef.current;
    if (active && device) {
      try {
        await BleClient.stopNotifications(device.deviceId, active.service, active.characteristic);
      } catch {
        // Device may already have disconnected.
      }
    }
    notificationRef.current = null;
    setNotifying(false);
  }, []);

  const stopScan = useCallback(async () => {
    if (scanTimeout.current) {
      clearTimeout(scanTimeout.current);
      scanTimeout.current = null;
    }
    try {
      await BleClient.stopLEScan();
    } catch {
      // The scan may already have stopped.
    }
    setScanning(false);
  }, []);

  const scan = useCallback(async () => {
    setError('');
    setStatus('');
    setDevices([]);
    if (!Capacitor.isNativePlatform()) {
      setError(t('فحص BLE يحتاج نسخة Android أو iOS مثبتة، وليس معاينة المتصفح.', 'BLE scanning requires the installed Android or iOS app, not a browser preview.'));
      return;
    }
    try {
      await BleClient.initialize();
      setScanning(true);
      await BleClient.requestLEScan({ allowDuplicates: false }, (result) => {
        setDevices((current) => {
          const next = current.filter((entry) => entry.device.deviceId !== result.device.deviceId);
          next.push({ device: result.device, rssi: result.rssi, localName: result.localName });
          return next.sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
        });
      });
      scanTimeout.current = setTimeout(() => { void stopScan(); }, 8000);
      setStatus(t('جارٍ البحث عن أجهزة Bluetooth LE لمدة 8 ثوانٍ...', 'Scanning for Bluetooth LE devices for 8 seconds...'));
    } catch (reason) {
      setScanning(false);
      setError(reason instanceof Error ? reason.message : t('تعذر بدء فحص Bluetooth.', 'Unable to start Bluetooth scan.'));
    }
  }, [stopScan, t]);

  const connect = useCallback(async (device: BleDevice) => {
    setError('');
    setStatus('');
    setConnecting(true);
    try {
      await stopScan();
      await stopNotification();
      if (deviceRef.current) {
        await BleClient.disconnect(deviceRef.current.deviceId).catch(() => undefined);
      }
      setServices([]);
      setServiceUuid('');
      setCharacteristicUuid('');
      setLastValue('');
      await BleClient.connect(device.deviceId, () => {
        setConnected(false);
        setServices([]);
        setServiceUuid('');
        setCharacteristicUuid('');
        setStatus(t('انقطع اتصال Bluetooth.', 'Bluetooth device disconnected.'));
      });
      deviceRef.current = device;
      setSelectedDevice(device);
      const discovered = await BleClient.getServices(device.deviceId);
      setServices(discovered);
      const firstService = discovered.find((service) => service.characteristics.some((item) => item.properties.read || item.properties.notify || item.properties.indicate));
      const firstCharacteristic = firstService?.characteristics.find((item) => item.properties.read || item.properties.notify || item.properties.indicate);
      setServiceUuid(firstService?.uuid || '');
      setCharacteristicUuid(firstCharacteristic?.uuid || '');
      setConnected(true);
      setStatus(t('تم الاتصال. اختر خاصية قابلة للقراءة لفحص البيانات الخام.', 'Connected. Select a readable characteristic to inspect raw data.'));
    } catch (reason) {
      setConnected(false);
      setSelectedDevice(null);
      deviceRef.current = null;
      setError(reason instanceof Error ? reason.message : t('فشل الاتصال بجهاز Bluetooth.', 'Bluetooth connection failed.'));
    } finally {
      setConnecting(false);
    }
  }, [stopNotification, stopScan, t]);

  const disconnect = useCallback(async () => {
    await stopNotification();
    const device = deviceRef.current;
    if (device) {
      try { await BleClient.disconnect(device.deviceId); } catch { /* already disconnected */ }
    }
    deviceRef.current = null;
    setSelectedDevice(null);
    setConnected(false);
    setServices([]);
    setServiceUuid('');
    setCharacteristicUuid('');
    setLastValue('');
    setStatus(t('تم قطع الاتصال.', 'Disconnected.'));
  }, [stopNotification, t]);

  const readSelected = useCallback(async () => {
    if (!selectedDevice || !selectedService || !selectedCharacteristic || !selectedCharacteristic.properties.read) return;
    setReading(true);
    setError('');
    try {
      const value = await BleClient.read(selectedDevice.deviceId, selectedService.uuid, selectedCharacteristic.uuid);
      setLastValue(rawValue(value));
      setStatus(t('تمت القراءة بنجاح. القيمة معروضة بصيغتها الخام دون تفسير.', 'Read succeeded. Value is shown as raw bytes without interpretation.'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('تعذرت قراءة الخاصية.', 'Characteristic read failed.'));
    } finally {
      setReading(false);
    }
  }, [selectedCharacteristic, selectedDevice, selectedService, t]);

  const toggleNotifications = useCallback(async () => {
    if (!selectedDevice || !selectedService || !selectedCharacteristic) return;
    if (notifying) {
      await stopNotification();
      return;
    }
    if (!selectedCharacteristic.properties.notify && !selectedCharacteristic.properties.indicate) return;
    setError('');
    try {
      await BleClient.startNotifications(
        selectedDevice.deviceId,
        selectedService.uuid,
        selectedCharacteristic.uuid,
        (value) => setLastValue(rawValue(value))
      );
      notificationRef.current = { service: selectedService.uuid, characteristic: selectedCharacteristic.uuid };
      setNotifying(true);
      setStatus(t('تم تفعيل استقبال التحديثات الخام.', 'Raw characteristic notifications enabled.'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('تعذر تفعيل التحديثات.', 'Unable to enable notifications.'));
    }
  }, [notifying, selectedCharacteristic, selectedDevice, selectedService, stopNotification, t]);

  useEffect(() => () => {
    if (scanTimeout.current) clearTimeout(scanTimeout.current);
    void BleClient.stopLEScan().catch(() => undefined);
    const active = notificationRef.current;
    const device = deviceRef.current;
    if (active && device) void BleClient.stopNotifications(device.deviceId, active.service, active.characteristic).catch(() => undefined);
    if (device) void BleClient.disconnect(device.deviceId).catch(() => undefined);
  }, []);

  const canRead = Boolean(selectedDevice && selectedCharacteristic?.properties.read);
  const canNotify = Boolean(selectedDevice && (selectedCharacteristic?.properties.notify || selectedCharacteristic?.properties.indicate));

  return (
    <section className="ble-explorer" aria-labelledby="ble-explorer-title">
      <div className="ble-explorer-heading">
        <div>
          <span className="ble-explorer-eyebrow">NATIVE BLUETOOTH LE · GATT · READ ONLY</span>
          <h3 id="ble-explorer-title">{t('فاحص Bluetooth LE للأجهزة القريبة', 'Bluetooth LE device explorer')}</h3>
          <p>{t('بحث واتصال واستكشاف خدمات GATT وقراءة الخصائص دون إرسال أوامر تحكم.', 'Scan, connect, inspect GATT services and read characteristics without sending control commands.')}</p>
        </div>
        <span className={connected ? 'ble-state ble-state-live' : 'ble-state'}>{connected ? t('متصل', 'CONNECTED') : t('غير متصل', 'DISCONNECTED')}</span>
      </div>

      <div className="ble-explorer-actions">
        <button type="button" onClick={() => void scan()} disabled={scanning || connecting || connected}>
          {scanning ? t('جارٍ البحث...', 'Scanning...') : t('ابحث عن أجهزة BLE', 'Scan for BLE devices')}
        </button>
        {scanning && <button type="button" className="ble-secondary" onClick={() => void stopScan()}>{t('إيقاف البحث', 'Stop scan')}</button>}
        {connected && <button type="button" className="ble-danger" onClick={() => void disconnect()}>{t('قطع الاتصال', 'Disconnect')}</button>}
      </div>

      {devices.length > 0 && !connected && (
        <div className="ble-device-list">
          {devices.map((entry) => (
            <button type="button" className="ble-device-row" key={entry.device.deviceId} onClick={() => void connect(entry.device)} disabled={connecting}>
              <span><strong>{entry.localName || entry.device.name || t('جهاز بدون اسم', 'Unnamed device')}</strong><small>{entry.device.deviceId}</small></span>
              <span className="ble-rssi">{entry.rssi !== undefined ? entry.rssi + ' dBm' : 'RSSI —'}</span>
            </button>
          ))}
        </div>
      )}

      {connecting && <p className="ble-muted">{t('جارٍ الاتصال واكتشاف الخدمات...', 'Connecting and discovering services...')}</p>}
      {connected && selectedDevice && (
        <div className="ble-connected-panel">
          <div className="ble-connected-device">
            <strong>{selectedDevice.name || t('جهاز Bluetooth', 'Bluetooth device')}</strong>
            <small>{selectedDevice.deviceId}</small>
          </div>
          <div className="ble-select-grid">
            <label>{t('خدمة GATT', 'GATT service')}
              <select value={serviceUuid} onChange={(event) => {
                setServiceUuid(event.target.value);
                const next = services.find((item) => item.uuid === event.target.value);
                const first = next?.characteristics.find((item) => item.properties.read || item.properties.notify || item.properties.indicate);
                setCharacteristicUuid(first?.uuid || '');
                setLastValue('');
              }}>
                {services.map((service) => <option key={service.uuid} value={service.uuid}>{service.uuid}</option>)}
              </select>
            </label>
            <label>{t('الخاصية', 'Characteristic')}
              <select value={characteristicUuid} onChange={(event) => { setCharacteristicUuid(event.target.value); setLastValue(''); }}>
                {readableCharacteristics.map((item) => <option key={item.uuid} value={item.uuid}>{item.uuid} · {item.properties.read ? 'READ ' : ''}{item.properties.notify ? 'NOTIFY ' : ''}{item.properties.indicate ? 'INDICATE' : ''}</option>)}
              </select>
            </label>
          </div>
          <div className="ble-explorer-actions">
            <button type="button" onClick={() => void readSelected()} disabled={!canRead || reading}>{reading ? t('جارٍ القراءة...', 'Reading...') : t('قراءة القيمة الخام', 'Read raw value')}</button>
            {canNotify && <button type="button" className="ble-secondary" onClick={() => void toggleNotifications()}>{notifying ? t('إيقاف التحديثات', 'Stop notifications') : t('استقبال التحديثات', 'Start notifications')}</button>}
          </div>
          {lastValue && <div className="ble-raw-value"><span>{t('البيانات الخام (HEX)', 'RAW DATA (HEX)')}</span><code>{lastValue}</code></div>}
          {services.length === 0 && <p className="ble-muted">{t('لم يعلن الجهاز عن خدمات GATT قابلة للاستكشاف.', 'The device did not expose discoverable GATT services.')}</p>}
        </div>
      )}

      {status && <p className="ble-muted" role="status">{status}</p>}
      {error && <p className="ble-error" role="alert">{error}</p>}
      <div className="ble-safety-note">
        {t('حدود مهمة: هذا فاحص BLE عام لقراءة GATT الخام. لا يدعم Bluetooth Classic ولا يفك تشفير بروتوكولات الشركات الخاصة تلقائيًا. لا تُعرض القيم كقياسات شاتل حقيقية إلا بعد توثيق UUIDs وطريقة فك البيانات واختبارها مع الشركة المصنّعة.', 'Important limits: this is a generic BLE GATT raw reader. It does not support Bluetooth Classic or automatically decode proprietary vendor protocols. Values must not be presented as real shuttle telemetry until UUIDs, decoding rules and vendor validation are documented and tested.')}
      </div>
    </section>
  );
}
