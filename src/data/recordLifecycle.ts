import type { Fault, MaintenanceJob } from '../types';

export interface LifecycleResult<T> {
  records: T[];
  changed: boolean;
  message?: string;
}

/** Soft-archive a fault without deleting its evidence or corrective-action history. */
export function archiveFaultRecord(
  faults: Fault[],
  id: string,
  timestamp = new Date().toISOString()
): LifecycleResult<Fault> {
  const current = faults.find((item) => item.id === id && !item.archivedAt);
  if (!current) return { records: faults, changed: false, message: 'Fault record was not found or is already archived.' };
  return {
    records: faults.map((item) => item.id === id ? { ...item, archivedAt: timestamp } : item),
    changed: true
  };
}

export function restoreFaultRecord(faults: Fault[], id: string): LifecycleResult<Fault> {
  const current = faults.find((item) => item.id === id && item.archivedAt);
  if (!current) return { records: faults, changed: false, message: 'Archived fault record was not found.' };
  return {
    records: faults.map((item) => item.id === id ? { ...item, archivedAt: null } : item),
    changed: true
  };
}

/**
 * Completed work orders can be archived. Open or in-progress work stays visible
 * in the operational queue so that archiving cannot silently hide unfinished work.
 */
export function archiveCompletedWorkOrder(
  jobs: MaintenanceJob[],
  id: string,
  timestamp = new Date().toISOString()
): LifecycleResult<MaintenanceJob> {
  const current = jobs.find((item) => item.id === id && !item.archivedAt);
  if (!current) return { records: jobs, changed: false, message: 'Work order was not found or is already archived.' };
  if (current.status !== 'Completed') {
    return { records: jobs, changed: false, message: 'Only completed work orders can be archived.' };
  }
  return {
    records: jobs.map((item) => item.id === id ? { ...item, archivedAt: timestamp } : item),
    changed: true
  };
}

export function restoreWorkOrder(jobs: MaintenanceJob[], id: string): LifecycleResult<MaintenanceJob> {
  const current = jobs.find((item) => item.id === id && item.archivedAt);
  if (!current) return { records: jobs, changed: false, message: 'Archived work order was not found.' };
  return {
    records: jobs.map((item) => item.id === id ? { ...item, archivedAt: null } : item),
    changed: true
  };
}
