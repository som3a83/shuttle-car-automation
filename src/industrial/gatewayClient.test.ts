import { describe, expect, it } from 'vitest';
import { getGatewaySampleState, type GatewaySample } from './gatewayClient';
const live: GatewaySample = {
  assetId: 'SC-01', tag: 'battery.soc', value: 71, unit: '%',
  sourceTimestamp: '2026-11-17T00:00:00.000Z', receivedAt: '2026-11-17T00:00:01.000Z',
  quality: 'GOOD', provenance: 'LIVE_VENDOR', adapterId: 'vendor-ro-adapter', adapterVersion: '1.0.0'
};
describe('gateway telemetry provenance checks', () => {
  it('accepts only recent, good, identified vendor samples as live', () => {
    expect(getGatewaySampleState(live, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('LIVE');
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
