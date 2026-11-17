import { describe, expect, it } from 'vitest';
import {
  assertReadOnlyAdapter,
  getTelemetryDisplayState,
  validateTelemetrySample,
  type TelemetrySample
} from './telemetry';

const live: TelemetrySample = {
  assetId: 'SC-01',
  tag: 'battery.soc',
  value: 72,
  unit: '%',
  sourceTimestamp: '2026-11-17T00:00:00.000Z',
  receivedAt: '2026-11-17T00:00:01.000Z',
  quality: 'GOOD',
  provenance: 'LIVE_VENDOR',
  adapterId: 'vendor-adapter-test',
  adapterVersion: '1.0.0'
};

describe('industrial telemetry safety and provenance contract', () => {
  it('accepts only a fresh, good, vendor-sourced sample as LIVE', () => {
    expect(getTelemetryDisplayState(live, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('LIVE');
  });

  it('never treats manual or simulated values as live', () => {
    expect(getTelemetryDisplayState({ ...live, provenance: 'MANUAL' }, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('UNVERIFIED');
    expect(getTelemetryDisplayState({ ...live, provenance: 'SIMULATED' }, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('UNVERIFIED');
  });

  it('marks old samples stale and null values unavailable, not zero', () => {
    expect(getTelemetryDisplayState(live, Date.parse('2026-11-17T00:01:00.000Z'))).toBe('STALE');
    expect(getTelemetryDisplayState({ ...live, value: null }, Date.parse('2026-11-17T00:00:02.000Z'))).toBe('UNAVAILABLE');
  });

  it('rejects malformed samples', () => {
    expect(validateTelemetrySample(live)).toBe(true);
    expect(validateTelemetrySample({ ...live, quality: 'HEALTHY' })).toBe(false);
    expect(validateTelemetrySample({ ...live, assetId: '' })).toBe(false);
  });

  it('requires explicit read-only adapter identity before commissioning', () => {
    expect(() => assertReadOnlyAdapter({
      id: 'adapter', manufacturer: 'Cassioli', model: 'Exact model', firmware: '1.2',
      mode: 'READ_ONLY', read: async () => []
    })).not.toThrow();
    expect(() => assertReadOnlyAdapter({
      id: 'adapter', manufacturer: 'Cassioli', model: '', firmware: '1.2',
      mode: 'READ_ONLY', read: async () => []
    })).toThrow();
  });
});
