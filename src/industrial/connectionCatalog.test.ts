import { describe, expect, it } from 'vitest';
import { CONNECTION_OPTIONS, getConnectionOption, isConnectionIdentifier } from './connectionCatalog';

describe('universal connection catalog', () => {
  it('exposes common mobile, network, serial and industrial radio transports', () => {
    const ids = CONNECTION_OPTIONS.filter((item) => item.family === 'transport').map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([
      'wifi', 'ethernet', 'bluetooth-le', 'bluetooth-classic', 'usb-serial',
      'rs232', 'rs485', 'radio-gateway', 'cellular'
    ]));
  });

  it('exposes common industrial protocols and vendor extension points', () => {
    const ids = CONNECTION_OPTIONS.filter((item) => item.family === 'protocol').map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining([
      'modbus-tcp', 'modbus-rtu', 'opc-ua', 'mqtt', 'rest-api', 'websocket',
      'siemens-s7', 'ethernet-ip', 'profinet', 'canopen', 'ble-gatt',
      'rf-proprietary', 'vendor-sdk', 'custom'
    ]));
  });

  it('requires commissioning for every physical connection option', () => {
    expect(CONNECTION_OPTIONS.every((option) => option.requiresCommissioning)).toBe(true);
    expect(getConnectionOption('rf-proprietary')?.integration).toBe('vendor-adapter');
  });

  it('accepts vendor-defined identifiers without accepting unsafe strings', () => {
    expect(isConnectionIdentifier('vendor.example.radio-v2')).toBe(true);
    expect(isConnectionIdentifier('modbus-tcp')).toBe(true);
    expect(isConnectionIdentifier('../plc')).toBe(false);
    expect(isConnectionIdentifier('')).toBe(false);
    expect(isConnectionIdentifier('UPPER CASE')).toBe(false);
  });
});
