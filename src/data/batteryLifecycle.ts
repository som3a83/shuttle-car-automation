import type { Battery, BatteryMovement, Shuttle } from '../types';

const movement = (
  battery: Battery,
  action: BatteryMovement['action'],
  fromShuttleId: string,
  toShuttleId: string,
  note: string,
  timestamp: string
): BatteryMovement => ({
  id: `${battery.id}-MOV-${timestamp.replace(/[^0-9]/g, '').slice(0, 14)}-${action.toUpperCase()}`,
  timestamp,
  action,
  fromShuttleId: fromShuttleId || 'Unassigned',
  toShuttleId: toShuttleId || 'Unassigned',
  note,
  source: 'MANUAL'
});

export interface BatteryAssignmentResult {
  batteries: Battery[];
  shuttles: Shuttle[];
  changed: boolean;
  message?: string;
}

/**
 * Assign one battery to one active shuttle. Reconciles both sides of the
 * relationship and releases any battery already installed in the target.
 * This is a local register operation, not a physical battery-control command.
 */
export function assignBatteryToShuttle(
  batteries: Battery[],
  shuttles: Shuttle[],
  batteryId: string,
  targetShuttleId: string,
  timestamp = new Date().toISOString()
): BatteryAssignmentResult {
  const selected = batteries.find(item => item.id === batteryId && !item.archivedAt);
  if (!selected) return { batteries, shuttles, changed: false, message: 'Battery was not found or is archived.' };

  const target = targetShuttleId
    ? shuttles.find(item => item.id === targetShuttleId && !item.archivedAt)
    : undefined;
  if (targetShuttleId && !target) {
    return { batteries, shuttles, changed: false, message: 'Target shuttle was not found or is archived.' };
  }

  const previousShuttleId = selected.assignment === 'Unassigned' ? '' : selected.assignment;
  const currentTargetBatteryId = target?.installedBattery && target.installedBattery !== 'Not recorded'
    ? target.installedBattery
    : '';
  if (previousShuttleId === targetShuttleId &&
      (targetShuttleId === '' || target?.installedBattery === selected.id)) {
    return { batteries, shuttles, changed: false };
  }

  const nextBatteries = batteries.map(item => ({ ...item, movementHistory: [...(item.movementHistory || [])] }));
  const nextShuttles = shuttles.map(item => ({ ...item }));
  const selectedIndex = nextBatteries.findIndex(item => item.id === batteryId);
  const selectedBattery = nextBatteries[selectedIndex];
  const selectedAction: BatteryMovement['action'] = !targetShuttleId
    ? 'Removed'
    : previousShuttleId
      ? 'Reassigned'
      : 'Assigned';

  selectedBattery.movementHistory = [
    movement(
      selectedBattery,
      selectedAction,
      previousShuttleId,
      targetShuttleId,
      targetShuttleId
        ? `Manual assignment to ${targetShuttleId}; no physical machine command was sent.`
        : 'Manual removal from shuttle; no physical machine command was sent.',
      timestamp
    ),
    ...(selectedBattery.movementHistory || [])
  ];
  selectedBattery.assignment = targetShuttleId || 'Unassigned';
  selectedBattery.status = targetShuttleId ? 'Installed' : 'Available';

  if (currentTargetBatteryId && currentTargetBatteryId !== batteryId) {
    const displacedIndex = nextBatteries.findIndex(item => item.id === currentTargetBatteryId && !item.archivedAt);
    if (displacedIndex >= 0) {
      const displaced = nextBatteries[displacedIndex];
      displaced.movementHistory = [
        movement(displaced, 'Removed', targetShuttleId, '', `Released when ${batteryId} was assigned to ${targetShuttleId}; no physical machine command was sent.`, timestamp),
        ...(displaced.movementHistory || [])
      ];
      displaced.assignment = 'Unassigned';
      displaced.status = 'Available';
    }
  }

  nextShuttles.forEach(item => {
    if (item.installedBattery === batteryId) item.installedBattery = 'Not recorded';
    if (currentTargetBatteryId && item.installedBattery === currentTargetBatteryId) item.installedBattery = 'Not recorded';
  });
  if (targetShuttleId) {
    const targetIndex = nextShuttles.findIndex(item => item.id === targetShuttleId);
    if (targetIndex >= 0) nextShuttles[targetIndex].installedBattery = batteryId;
  }

  return { batteries: nextBatteries, shuttles: nextShuttles, changed: true };
}

export function archiveBatteryAndDetach(
  batteries: Battery[],
  shuttles: Shuttle[],
  batteryId: string,
  timestamp = new Date().toISOString()
): BatteryAssignmentResult {
  const selected = batteries.find(item => item.id === batteryId && !item.archivedAt);
  if (!selected) return { batteries, shuttles, changed: false, message: 'Battery was not found or is already archived.' };

  const fromShuttleId = selected.assignment === 'Unassigned' ? '' : selected.assignment;
  const nextBatteries = batteries.map(item => item.id === batteryId
    ? {
        ...item,
        archivedAt: timestamp,
        assignment: 'Unassigned',
        status: 'Available' as const,
        movementHistory: [
          movement(item, 'Archived', fromShuttleId, '', 'Battery record archived locally; history retained.', timestamp),
          ...(item.movementHistory || [])
        ]
      }
    : item);
  const nextShuttles = shuttles.map(item => item.installedBattery === batteryId
    ? { ...item, installedBattery: 'Not recorded' }
    : item);
  return { batteries: nextBatteries, shuttles: nextShuttles, changed: true };
}

export function restoreBatteryRecord(
  batteries: Battery[],
  batteryId: string,
  timestamp = new Date().toISOString()
): Battery[] {
  return batteries.map(item => item.id === batteryId && item.archivedAt
    ? {
        ...item,
        archivedAt: null,
        status: item.assignment === 'Unassigned' ? 'Available' : 'Installed',
        movementHistory: [
          movement(item, 'Restored', '', item.assignment === 'Unassigned' ? '' : item.assignment, 'Battery record restored locally; assignment was not automatically reconnected.', timestamp),
          ...(item.movementHistory || [])
        ]
      }
    : item);
}
