import { describe, expect, it } from 'vitest';
import { initialBatteries, initialShuttles } from './mockData';
import type { Battery } from '../types';
import { archiveBatteryAndDetach, assignBatteryToShuttle, restoreBatteryRecord } from './batteryLifecycle';

const spareBattery: Battery = {
  id: 'BAT-002', manufacturer: 'Cassioli', model: 'Not recorded', chemistry: 'Not verified',
  nominalVoltage: 'Not recorded', capacity: 'Not recorded', soc: null, soh: null,
  temperature: null, voltage: null, current: null, cycles: null, installationDate: 'Not recorded',
  lastMaintenance: 'Not recorded', assignment: 'Unassigned', notes: '', status: 'Available',
  connectionMode: 'UNKNOWN', movementHistory: []
};

describe('battery lifecycle and assignment consistency', () => {
  it('moves a spare battery to a shuttle and updates both sides of the relationship', () => {
    const result = assignBatteryToShuttle(
      [...initialBatteries, spareBattery],
      initialShuttles,
      spareBattery.id,
      'SC-01',
      '2026-11-17T07:00:00.000Z'
    );
    expect(result.changed).toBe(true);
    expect(result.batteries.find(item => item.id === spareBattery.id)).toMatchObject({
      assignment: 'SC-01', status: 'Installed',
      movementHistory: [expect.objectContaining({ action: 'Assigned', fromShuttleId: 'Unassigned', toShuttleId: 'SC-01', source: 'MANUAL' })]
    });
    expect(result.shuttles.find(item => item.id === 'SC-01')?.installedBattery).toBe(spareBattery.id);
  });

  it('releases the previously installed battery when replacing it', () => {
    const serviceableInstalled = { ...initialBatteries[0], status: 'Installed' as const };
    const result = assignBatteryToShuttle([serviceableInstalled], initialShuttles, 'BAT-ACME-01', 'SC-01', '2026-11-17T08:00:00.000Z');
    expect(result.changed).toBe(true);
    expect(result.shuttles.find(item => item.id === 'SC-05')?.installedBattery).toBe('Not recorded');
    expect(result.shuttles.find(item => item.id === 'SC-01')?.installedBattery).toBe('BAT-ACME-01');
    expect(result.batteries.find(item => item.id === 'BAT-ACME-01')?.movementHistory?.[0]).toMatchObject({
      action: 'Reassigned', fromShuttleId: 'SC-05', toShuttleId: 'SC-01'
    });
  });

  it('does not assign an archived battery or accept an unknown shuttle', () => {
    const archived = { ...spareBattery, archivedAt: '2026-11-16T00:00:00.000Z' };
    const archivedResult = assignBatteryToShuttle([archived], initialShuttles, archived.id, 'SC-01');
    const unknownResult = assignBatteryToShuttle([spareBattery], initialShuttles, spareBattery.id, 'SC-99');
    const faultedResult = assignBatteryToShuttle(initialBatteries, initialShuttles, 'BAT-ACME-01', 'SC-01');
    expect(archivedResult.changed).toBe(false);
    expect(unknownResult.changed).toBe(false);
    expect(unknownResult.message).toMatch(/Target shuttle/);
    expect(faultedResult.changed).toBe(false);
    expect(faultedResult.message).toMatch(/cannot be assigned/);
  });

  it('archives and detaches a battery while preserving its movement journal', () => {
    const result = archiveBatteryAndDetach(initialBatteries, initialShuttles, 'BAT-ACME-01', '2026-11-17T09:00:00.000Z');
    expect(result.batteries[0]).toMatchObject({
      archivedAt: '2026-11-17T09:00:00.000Z', assignment: 'Unassigned', status: 'Fault',
      movementHistory: [expect.objectContaining({ action: 'Archived', fromShuttleId: 'SC-05', toShuttleId: 'Unassigned' })]
    });
    expect(result.shuttles.find(item => item.id === 'SC-05')?.installedBattery).toBe('Not recorded');
  });

  it('restores an archived battery record without silently assigning it to a shuttle', () => {
    const archived = { ...spareBattery, archivedAt: '2026-11-16T00:00:00.000Z' };
    const restored = restoreBatteryRecord([archived], archived.id, '2026-11-17T10:00:00.000Z')[0];
    expect(restored.archivedAt).toBeNull();
    expect(restored.assignment).toBe('Unassigned');
    expect(restored.status).toBe('Available');
    expect(restored.movementHistory?.[0].action).toBe('Restored');
  });
});
