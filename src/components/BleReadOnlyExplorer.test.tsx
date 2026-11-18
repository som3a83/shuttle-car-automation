import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const ble = vi.hoisted(() => ({
  initialize: vi.fn(),
  requestLEScan: vi.fn(),
  stopLEScan: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  getServices: vi.fn(),
  read: vi.fn(),
  startNotifications: vi.fn(),
  stopNotifications: vi.fn(),
  write: vi.fn(),
  writeWithoutResponse: vi.fn()
}));

vi.mock('@capacitor-community/bluetooth-le', () => ({ BleClient: ble }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));

import BleReadOnlyExplorer from './BleReadOnlyExplorer';

describe('BLE read-only explorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ble.initialize.mockResolvedValue(undefined);
    ble.stopLEScan.mockResolvedValue(undefined);
    ble.connect.mockResolvedValue(undefined);
    ble.disconnect.mockResolvedValue(undefined);
    ble.getServices.mockResolvedValue([{
      uuid: '0000180f-0000-1000-8000-00805f9b34fb',
      characteristics: [{
        uuid: '00002a19-0000-1000-8000-00805f9b34fb',
        properties: {
          read: true, notify: true, indicate: false, write: false,
          writeWithoutResponse: false, broadcast: false, authenticatedSignedWrites: false
        },
        descriptors: []
      }]
    }]);
    ble.read.mockResolvedValue(new DataView(new Uint8Array([72, 105]).buffer));
    ble.startNotifications.mockResolvedValue(undefined);
    ble.stopNotifications.mockResolvedValue(undefined);
  });

  it('scans, connects, discovers GATT and reads raw values without writes', async () => {
    ble.requestLEScan.mockImplementation(async (_options, callback) => {
      callback({ device: { deviceId: 'AA:BB:CC:DD:EE:FF', name: 'Generic Shuttle BLE' }, rssi: -54 });
    });

    render(<BleReadOnlyExplorer language="en" />);
    fireEvent.click(screen.getByRole('button', { name: /Scan for BLE devices/i }));
    const deviceButton = await screen.findByRole('button', { name: /Generic Shuttle BLE/i });
    fireEvent.click(deviceButton);

    await screen.findByText(/Connected/i);
    fireEvent.click(screen.getByRole('button', { name: /Read raw value/i }));

    await waitFor(() => expect(screen.getByText('48 69')).toBeTruthy());
    expect(ble.initialize).toHaveBeenCalledOnce();
    expect(ble.connect).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF', expect.any(Function));
    expect(ble.getServices).toHaveBeenCalledWith('AA:BB:CC:DD:EE:FF');
    expect(ble.read).toHaveBeenCalledWith(
      'AA:BB:CC:DD:EE:FF',
      '0000180f-0000-1000-8000-00805f9b34fb',
      '00002a19-0000-1000-8000-00805f9b34fb'
    );
    expect(ble.write).not.toHaveBeenCalled();
    expect(ble.writeWithoutResponse).not.toHaveBeenCalled();
  });

  it('keeps BLE unavailable in browser preview rather than pretending to scan', async () => {
    const core = await import('@capacitor/core');
    vi.spyOn(core.Capacitor, 'isNativePlatform').mockReturnValue(false);
    render(<BleReadOnlyExplorer language="en" />);
    fireEvent.click(screen.getByRole('button', { name: /Scan for BLE devices/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/installed Android or iOS app/i);
    expect(ble.requestLEScan).not.toHaveBeenCalled();
  });
});
