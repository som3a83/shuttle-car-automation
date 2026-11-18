/**
 * Universal shuttle connection catalog.
 *
 * These are selectable integration families, not a claim that every shuttle
 * implements every interface. Production access is enabled only by a reviewed
 * adapter for the exact machine, controller, firmware and approved read-only
 * tag map. Vendor-specific identifiers are supported through the same contract.
 */

export type ConnectionFamily = 'transport' | 'protocol';

export interface ConnectionOption {
  id: string;
  family: ConnectionFamily;
  name: string;
  nameAr: string;
  integration: 'mobile-native' | 'edge-gateway' | 'vendor-adapter';
  requiresCommissioning: true;
}

export const CONNECTION_OPTIONS: readonly ConnectionOption[] = [
  { id: 'wifi', family: 'transport', name: 'Wi-Fi', nameAr: 'واي فاي', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'ethernet', family: 'transport', name: 'Ethernet', nameAr: 'إيثرنت', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'bluetooth-le', family: 'transport', name: 'Bluetooth Low Energy', nameAr: 'بلوتوث منخفض الطاقة', integration: 'mobile-native', requiresCommissioning: true },
  { id: 'bluetooth-classic', family: 'transport', name: 'Bluetooth Classic / RFCOMM', nameAr: 'بلوتوث كلاسيك', integration: 'mobile-native', requiresCommissioning: true },
  { id: 'usb-serial', family: 'transport', name: 'USB Serial', nameAr: 'USB تسلسلي', integration: 'mobile-native', requiresCommissioning: true },
  { id: 'rs232', family: 'transport', name: 'RS-232', nameAr: 'RS-232', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'rs485', family: 'transport', name: 'RS-485', nameAr: 'RS-485', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'radio-gateway', family: 'transport', name: 'Industrial Radio Gateway', nameAr: 'بوابة راديو صناعي', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'cellular', family: 'transport', name: 'Cellular / 4G / 5G', nameAr: 'اتصال خلوي 4G / 5G', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'vpn-tunnel', family: 'transport', name: 'Approved VPN Tunnel', nameAr: 'نفق VPN معتمد', integration: 'edge-gateway', requiresCommissioning: true },

  { id: 'modbus-tcp', family: 'protocol', name: 'Modbus TCP', nameAr: 'مودباص TCP', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'modbus-rtu', family: 'protocol', name: 'Modbus RTU', nameAr: 'مودباص RTU', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'opc-ua', family: 'protocol', name: 'OPC UA', nameAr: 'OPC UA', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'mqtt', family: 'protocol', name: 'MQTT', nameAr: 'MQTT', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'rest-api', family: 'protocol', name: 'REST API', nameAr: 'REST API', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'websocket', family: 'protocol', name: 'WebSocket', nameAr: 'WebSocket', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'raw-tcp', family: 'protocol', name: 'Vendor TCP Protocol', nameAr: 'بروتوكول TCP خاص بالمصنّع', integration: 'vendor-adapter', requiresCommissioning: true },
  { id: 'raw-udp', family: 'protocol', name: 'Vendor UDP Protocol', nameAr: 'بروتوكول UDP خاص بالمصنّع', integration: 'vendor-adapter', requiresCommissioning: true },
  { id: 'siemens-s7', family: 'protocol', name: 'Siemens S7', nameAr: 'Siemens S7', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'ethernet-ip', family: 'protocol', name: 'EtherNet/IP', nameAr: 'EtherNet/IP', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'profinet', family: 'protocol', name: 'PROFINET', nameAr: 'PROFINET', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'canopen', family: 'protocol', name: 'CANopen', nameAr: 'CANopen', integration: 'edge-gateway', requiresCommissioning: true },
  { id: 'ble-gatt', family: 'protocol', name: 'Bluetooth GATT', nameAr: 'Bluetooth GATT', integration: 'mobile-native', requiresCommissioning: true },
  { id: 'rf-proprietary', family: 'protocol', name: 'Proprietary Radio Protocol', nameAr: 'بروتوكول راديو خاص بالمصنّع', integration: 'vendor-adapter', requiresCommissioning: true },
  { id: 'vendor-sdk', family: 'protocol', name: 'Manufacturer SDK / API', nameAr: 'واجهة أو حزمة المصنّع', integration: 'vendor-adapter', requiresCommissioning: true },
  { id: 'custom', family: 'protocol', name: 'Custom Vendor Protocol', nameAr: 'بروتوكول مخصص للمصنّع', integration: 'vendor-adapter', requiresCommissioning: true }
] as const;

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export function isConnectionIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER_PATTERN.test(value);
}

export function getConnectionOption(id: string): ConnectionOption | undefined {
  return CONNECTION_OPTIONS.find((option) => option.id === id);
}
