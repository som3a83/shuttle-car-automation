import { describe, expect, it } from 'vitest';
import type { Fault, MaintenanceJob } from '../types';
import { archiveCompletedWorkOrder, archiveFaultRecord, restoreFaultRecord, restoreWorkOrder } from './recordLifecycle';

const fault: Fault = {
  id: 'FLT-1', shuttleId: 'SC-01', title: 'Sensor warning', severity: 'Minor', status: 'Resolved',
  timestamp: '2026-11-17T10:00:00.000Z', description: 'Reported observation',
  probableCauses: ['Not confirmed'], diagnosticProcedure: 'Inspect according to approved procedure',
  correctiveAction: 'Re-seated connector and verified by technician', assignedTechnician: 'Tech A'
};
const job = (status: MaintenanceJob['status']): MaintenanceJob => ({
  id: 'MNT-1', shuttleId: 'SC-01', title: 'Inspect drive assembly', type: 'Preventive',
  status, scheduledDate: '2026-11-20', technician: 'Tech A', notes: 'Routine inspection'
});

describe('operational record lifecycle', () => {
  it('archives and restores faults without losing the original report or corrective action', () => {
    const archived = archiveFaultRecord([fault], fault.id, '2026-11-17T12:00:00.000Z');
    expect(archived.changed).toBe(true);
    expect(archived.records[0]).toMatchObject({
      archivedAt: '2026-11-17T12:00:00.000Z',
      id: 'FLT-1',
      correctiveAction: fault.correctiveAction,
      status: 'Resolved'
    });
    const restored = restoreFaultRecord(archived.records, fault.id);
    expect(restored.records[0].archivedAt).toBeNull();
    expect(restored.records[0].correctiveAction).toBe(fault.correctiveAction);
  });

  it('does not archive unresolved faults', () => {
    const openFault = { ...fault, status: 'Open' as const, correctiveAction: '' };
    const result = archiveFaultRecord([openFault], openFault.id);
    expect(result.changed).toBe(false);
    expect(result.message).toMatch(/Only resolved fault records/);
    expect(result.records[0].archivedAt).toBeUndefined();
  });

  it('does not archive unfinished work orders', () => {
    for (const status of ['Scheduled', 'In Progress', 'Overdue'] as const) {
      const result = archiveCompletedWorkOrder([job(status)], 'MNT-1');
      expect(result.changed).toBe(false);
      expect(result.records[0].archivedAt).toBeUndefined();
    }
  });

  it('archives and restores completed work orders while retaining their status and notes', () => {
    const archived = archiveCompletedWorkOrder([job('Completed')], 'MNT-1', '2026-11-17T12:00:00.000Z');
    expect(archived.changed).toBe(true);
    expect(archived.records[0]).toMatchObject({ archivedAt: '2026-11-17T12:00:00.000Z', status: 'Completed', notes: 'Routine inspection' });
    const restored = restoreWorkOrder(archived.records, 'MNT-1');
    expect(restored.records[0].archivedAt).toBeNull();
  });

  it('returns unchanged arrays for unknown and already archived IDs', () => {
    expect(archiveFaultRecord([fault], 'missing').changed).toBe(false);
    expect(restoreFaultRecord([fault], 'missing').changed).toBe(false);
    expect(archiveCompletedWorkOrder([job('Completed')], 'missing').changed).toBe(false);
    expect(restoreWorkOrder([job('Completed')], 'missing').changed).toBe(false);
  });
});
