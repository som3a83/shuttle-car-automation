import { describe, expect, it } from 'vitest';
import { initialBatteries, initialShuttles } from './mockData';

describe('Fleet seed data quality and provenance', () => {
  it('contains exactly the operator-reported fleet composition', () => {
    expect(initialShuttles).toHaveLength(5);
    expect(initialShuttles.filter((item) => item.manufacturer === 'Cassioli')).toHaveLength(3);
    expect(initialShuttles.filter((item) => item.manufacturer === 'Craftsman')).toHaveLength(1);
    expect(initialShuttles.filter((item) => item.manufacturer === 'ACME')).toHaveLength(1);
  });

  it('records the confirmed installed model families without inventing serials or telemetry', () => {
    expect(initialShuttles.map((shuttle) => shuttle.model)).toEqual([
      'ISAT Semi-Automatic', 'ISAT Semi-Automatic', 'ISAT Semi-Automatic',
      'Pallet Shuttle (Standard)', 'Namla Polar Edition'
    ]);
    for (const shuttle of initialShuttles) {
      expect(shuttle.serialNumber).toBe('Not recorded');
      expect(shuttle.hardwareVersion).toBe('Not recorded');
      expect(shuttle.firmwareVersion).toBe('Not recorded');
      expect(shuttle.connectivity).toBe('UNKNOWN');
      expect(shuttle.operatingHours).toBeNull();
      expect(shuttle.operatingCycles).toBeNull();
      expect(shuttle.lastCommunication).toBe('Not connected');
    }
  });

  it('preserves the reported ACME HMI zero as unverified, not live telemetry', () => {
    const battery = initialBatteries.find((item) => item.manufacturer === 'ACME');
    expect(battery).toBeDefined();
    expect(battery?.soc).toBeNull();
    expect(battery?.notes).toMatch(/HMI was manually reported to display 0%/i);
    expect(battery?.connectionMode).toBe('UNKNOWN');
    expect(battery?.soh).toBeNull();
    expect(battery?.temperature).toBeNull();
    expect(battery?.voltage).toBeNull();
    expect(battery?.current).toBeNull();
  });
});
