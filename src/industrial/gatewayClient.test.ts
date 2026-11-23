import { describe, expect, it } from 'vitest';
import { fetchGatewayStatus, getGatewaySampleState, type GatewaySample } from './gatewayClient';
import { vi } from 'vitest';
const live: GatewaySample = {
  assetId: 'SC-01', tag: 'battery.soc', value: 71, unit: '%',
  sourceTimestamp: '2026-11-17T00:00:00.000Z', receivedAt: '2026-11-17T00:00:01.000Z',
  quality: 'GOOD', provenance: 'LIVE_VENDOR', adapterId: 'vendor-ro-adapter', adapterVersion: '1.0.0',
  transport: 'wifi', protocol: 'modbus-tcp'
};
describe('gateway telemetry provenance checks', () => {
  it('accepts only recent, good, identified vendor samples as live', () => {
    expect(getGatewaySampleState(live, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('LIVE');
  });
  it('does not mark legacy readings without a known transport or protocol as live', () => {
    expect(getGatewaySampleState({ ...live, transport: 'unknown' }, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('UNVERIFIED');
    expect(getGatewaySampleState({ ...live, protocol: 'unknown' }, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('UNVERIFIED');
  });
  it('does not mark manual or simulated values as live', () => {
    expect(getGatewaySampleState({ ...live, provenance: 'MANUAL' }, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('UNVERIFIED');
    expect(getGatewaySampleState({ ...live, provenance: 'SIMULATED' }, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('UNVERIFIED');
  });
  it('marks delayed samples stale and missing values unavailable', () => {
    expect(getGatewaySampleState(live, Date.parse('2026-11-17T00:01:00.000Z'))).toBe('STALE');
    expect(getGatewaySampleState({ ...live, value: null }, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('UNAVAILABLE');
  });
  it('requires a vendor timestamp and adapter identity', () => {
    expect(getGatewaySampleState({ ...live, sourceTimestamp: null }, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('UNVERIFIED');
    expect(getGatewaySampleState({ ...live, adapterId: null }, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('UNVERIFIED');
  });
});


describe('read-only gateway HTTP client contract', () => {
  it('accepts only the expected read-only gateway status and sends a bearer read token', async () => {
    const payload = {
      service: 'shuttle-read-only-gateway',
      version: '1.0.0',
      readOnly: true,
      controlRoutes: false,
      assetCount: 1,
      commissionedCount: 1,
      assets: [{
        id: 'SC-01', manufacturer: 'Cassioli', model: 'Not recorded', firmware: null,
        adapterId: 'approved-ro-adapter', enabled: true, commissioned: true,
        transports: ['ethernet'], protocols: ['modbus-tcp'], missing: []
      }]
    };
    const request = vi.fn(async () => ({ ok: true, json: async () => payload }) as unknown as Response);
    vi.stubGlobal('fetch', request);
    try {
      const result = await fetchGatewayStatus('https://gateway.example.test', 'read-only-token');
      expect(result.readOnly).toBe(true);
      expect(result.controlRoutes).toBe(false);
      expect(result.assets[0]).toMatchObject({ id: 'SC-01', commissioned: true, adapterId: 'approved-ro-adapter' });
      expect(request).toHaveBeenCalledWith('https://gateway.example.test/v1/status', expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer read-only-token' }),
        credentials: 'omit',
        redirect: 'error'
      }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects any gateway response that advertises control routes', async () => {
    const request = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        service: 'shuttle-read-only-gateway', readOnly: true, controlRoutes: true,
        assetCount: 0, commissionedCount: 0, assets: []
      })
    }) as unknown as Response);
    vi.stubGlobal('fetch', request);
    try {
      await expect(fetchGatewayStatus('https://gateway.example.test', 'read-only-token'))
        .rejects.toThrow(/القراءة فقط/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects insecure non-local HTTP gateway URLs before making a request', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    try {
      await expect(fetchGatewayStatus('http://192.168.1.20', 'read-only-token'))
        .rejects.toThrow(/HTTPS/);
      expect(request).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
