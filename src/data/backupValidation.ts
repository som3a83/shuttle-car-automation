import type {
  AppSettings,
  Battery,
  ConnectivityStatus,
  DailyReportSnapshot,
  Fault,
  MaintenanceJob,
  NotificationItem,
  ShiftRecord,
  Shuttle,
  ShuttleStatus
} from '../types';

export interface OperationalBackup {
  schemaVersion?: number;
  exportedAt?: string;
  shuttles: Shuttle[];
  batteries: Battery[];
  faults: Fault[];
  jobs: MaintenanceJob[];
  notifications: NotificationItem[];
  settings?: AppSettings;
  dailyReports: DailyReportSnapshot[];
  shifts: ShiftRecord[];
}

export type BackupValidationResult =
  | { ok: true; data: OperationalBackup }
  | { ok: false; error: string };

const SHUTTLE_STATUSES: readonly ShuttleStatus[] = [
  'Ready', 'Running', 'Idle', 'Charging', 'Maintenance', 'Fault', 'Disconnected', 'Unknown'
];
const CONNECTIVITY: readonly ConnectivityStatus[] = ['REAL', 'SIMULATION', 'OFFLINE', 'UNKNOWN'];
const BATTERY_STATUSES: readonly Battery['status'][] = [
  'Installed', 'Spare', 'Charging', 'Discharging', 'Available', 'Maintenance', 'Fault'
];
const FAULT_SEVERITIES: readonly Fault['severity'][] = ['Critical', 'Major', 'Moderate', 'Minor'];
const FAULT_STATUSES: readonly Fault['status'][] = ['Open', 'Investigating', 'Resolved'];
const MAINTENANCE_TYPES: readonly MaintenanceJob['type'][] = ['Preventive', 'Corrective'];
const MAINTENANCE_STATUSES: readonly MaintenanceJob['status'][] = ['Scheduled', 'In Progress', 'Completed', 'Overdue'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function isString(value: unknown): value is string {
  return typeof value === 'string';
}
function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}
function isOptionalArchive(value: unknown): boolean {
  return value === undefined || value === null || isString(value);
}
function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}
function validIds<T extends { id: string }>(items: T[]): boolean {
  const ids = items.map((item) => item.id.trim());
  return ids.every(Boolean) && new Set(ids).size === ids.length;
}

function isShuttle(value: unknown): value is Shuttle {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.manufacturer) && isOptionalArchive(value.archivedAt) &&
    isString(value.model) && isString(value.serialNumber) && isString(value.hardwareVersion) &&
    isString(value.firmwareVersion) && isString(value.warehouseZone) &&
    SHUTTLE_STATUSES.includes(value.status as ShuttleStatus) &&
    CONNECTIVITY.includes(value.connectivity as ConnectivityStatus) &&
    isString(value.installedBattery) && isNullableNumber(value.operatingHours) &&
    isNullableNumber(value.operatingCycles) && stringArray(value.faultHistory) &&
    stringArray(value.maintenanceHistory) && isString(value.assignedOperator) &&
    isString(value.lastCommunication) && isString(value.notes);
}

function isBatteryMovement(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.timestamp) && isString(value.action) &&
    isString(value.fromShuttleId) && isString(value.toShuttleId) &&
    isString(value.note) && value.source === 'MANUAL';
}

function isBattery(value: unknown): value is Battery {
  if (!isRecord(value)) return false;
  const historyValid = value.movementHistory === undefined ||
    (Array.isArray(value.movementHistory) && value.movementHistory.every(isBatteryMovement));
  return isString(value.id) && isOptionalArchive(value.archivedAt) &&
    isString(value.manufacturer) && isString(value.model) && isString(value.chemistry) &&
    isString(value.nominalVoltage) && isString(value.capacity) &&
    isNullableNumber(value.soc) && (value.soc === null || (value.soc >= 0 && value.soc <= 100)) &&
    isNullableNumber(value.soh) && (value.soh === null || (value.soh >= 0 && value.soh <= 100)) &&
    isNullableNumber(value.temperature) && isNullableNumber(value.voltage) &&
    isNullableNumber(value.current) && isNullableNumber(value.cycles) &&
    isString(value.installationDate) && isString(value.lastMaintenance) &&
    isString(value.assignment) && isString(value.notes) &&
    BATTERY_STATUSES.includes(value.status as Battery['status']) &&
    CONNECTIVITY.includes(value.connectionMode as ConnectivityStatus) && historyValid;
}

function isFault(value: unknown): value is Fault {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.shuttleId) && isString(value.title) &&
    FAULT_SEVERITIES.includes(value.severity as Fault['severity']) &&
    FAULT_STATUSES.includes(value.status as Fault['status']) &&
    isString(value.timestamp) && isString(value.description) &&
    stringArray(value.probableCauses) && isString(value.diagnosticProcedure) &&
    (value.correctiveAction === undefined || isString(value.correctiveAction)) &&
    isString(value.assignedTechnician);
}

function isMaintenance(value: unknown): value is MaintenanceJob {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.shuttleId) && isString(value.title) &&
    MAINTENANCE_TYPES.includes(value.type as MaintenanceJob['type']) &&
    MAINTENANCE_STATUSES.includes(value.status as MaintenanceJob['status']) &&
    isString(value.scheduledDate) && isString(value.technician) && isString(value.notes);
}

function isNotification(value: unknown): value is NotificationItem {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.title) && isString(value.detail) &&
    ['info', 'warning', 'error'].includes(String(value.severity)) && isString(value.time);
}

function isSettings(value: unknown): value is AppSettings {
  if (!isRecord(value)) return false;
  return (value.language === 'en' || value.language === 'ar') &&
    (value.theme === 'dark' || value.theme === 'light') &&
    typeof value.notificationsEnabled === 'boolean' &&
    typeof value.maintenanceReminders === 'boolean' &&
    typeof value.batteryAlerts === 'boolean' &&
    typeof value.communicationAlerts === 'boolean';
}

function isDailyReport(value: unknown): value is DailyReportSnapshot {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.reportDate) && isString(value.generatedAt) &&
    ['shuttleCount', 'runningCount', 'readyCount', 'disconnectedCount', 'openFaultCount',
      'openMaintenanceCount', 'batteryCount', 'faultedBatteryCount', 'verifiedTelemetryCount'
    ].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key])) &&
    Array.isArray(value.shuttles) && value.shuttles.every((item) =>
      isRecord(item) && isString(item.id) && isString(item.manufacturer) &&
      SHUTTLE_STATUSES.includes(item.status as ShuttleStatus) &&
      CONNECTIVITY.includes(item.connectivity as ConnectivityStatus) && isString(item.warehouseZone)
    ) &&
    Array.isArray(value.batteries) && value.batteries.every((item) =>
      isRecord(item) && isString(item.id) && isString(item.manufacturer) &&
      BATTERY_STATUSES.includes(item.status as Battery['status']) && isString(item.assignment) &&
      isNullableNumber(item.soc) && CONNECTIVITY.includes(item.connectionMode as ConnectivityStatus)
    );
}

function isShift(value: unknown): value is ShiftRecord {
  if (!isRecord(value)) return false;
  return isString(value.id) && (value.shiftType === 'Day' || value.shiftType === 'Night') &&
    isString(value.startedAt) && (value.endedAt === null || isString(value.endedAt)) &&
    isString(value.supervisor) && isString(value.operators) &&
    isString(value.openingNotes) && isString(value.handoverNotes) &&
    Array.isArray(value.openingFleet) && Array.isArray(value.closingFleet) &&
    typeof value.openingOpenFaults === 'number' && Number.isFinite(value.openingOpenFaults) &&
    (value.closingOpenFaults === null || (typeof value.closingOpenFaults === 'number' && Number.isFinite(value.closingOpenFaults))) &&
    typeof value.openingOpenMaintenance === 'number' && Number.isFinite(value.openingOpenMaintenance) &&
    (value.closingOpenMaintenance === null || (typeof value.closingOpenMaintenance === 'number' && Number.isFinite(value.closingOpenMaintenance)));
}

/**
 * Validate the full import before mutating application state. Invalid data is rejected
 * atomically. Historical schema versions are accepted when their actual records remain valid.
 */
export function validateOperationalBackup(input: unknown): BackupValidationResult {
  if (!isRecord(input)) return { ok: false, error: 'Backup must contain a JSON object.' };
  const version = input.schemaVersion;
  if (version !== undefined && (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 10)) {
    return { ok: false, error: 'Backup schema version is unsupported.' };
  }
  const arrays = ['shuttles', 'batteries', 'faults', 'jobs'];
  if (arrays.some((key) => !Array.isArray(input[key]))) {
    return { ok: false, error: 'Backup is missing one or more required operational registers.' };
  }

  const shuttles = input.shuttles as unknown[];
  const batteries = input.batteries as unknown[];
  const faults = input.faults as unknown[];
  const jobs = input.jobs as unknown[];
  if (!shuttles.every(isShuttle) || !batteries.every(isBattery) ||
      !faults.every(isFault) || !jobs.every(isMaintenance)) {
    return { ok: false, error: 'One or more equipment, battery, fault or work-order records have an invalid structure.' };
  }
  if (!validIds(shuttles as Shuttle[]) || !validIds(batteries as Battery[]) ||
      !validIds(faults as Fault[]) || !validIds(jobs as MaintenanceJob[])) {
    return { ok: false, error: 'Duplicate or empty record IDs were found in the backup.' };
  }

  const shuttleById = new Map((shuttles as Shuttle[]).map((item) => [item.id, item]));
  const assignedTo = new Set<string>();
  for (const battery of batteries as Battery[]) {
    const target = battery.assignment.trim();
    if (!target || ['Unassigned', 'Not assigned', 'Not recorded'].includes(target)) continue;
    const shuttle = shuttleById.get(target);
    if (!shuttle || shuttle.archivedAt) {
      return { ok: false, error: `Battery ${battery.id} refers to a missing or archived shuttle.` };
    }
    if (assignedTo.has(target)) {
      return { ok: false, error: `More than one battery is assigned to shuttle ${target}.` };
    }
    assignedTo.add(target);
  }
  for (const shuttle of shuttles as Shuttle[]) {
    const installed = shuttle.installedBattery.trim();
    if (!installed || installed === 'Not recorded') continue;
    const battery = (batteries as Battery[]).find((item) => item.id === installed && !item.archivedAt);
    if (!battery || battery.assignment !== shuttle.id || shuttle.archivedAt) {
      return { ok: false, error: `Shuttle ${shuttle.id} has an inconsistent installed-battery reference.` };
    }
  }
  for (const fault of faults as Fault[]) {
    if (!shuttleById.has(fault.shuttleId)) {
      return { ok: false, error: `Fault ${fault.id} refers to an unknown shuttle.` };
    }
  }
  for (const job of jobs as MaintenanceJob[]) {
    if (!shuttleById.has(job.shuttleId)) {
      return { ok: false, error: `Work order ${job.id} refers to an unknown shuttle.` };
    }
  }

  const optionalArrays: Array<[string, (item: unknown) => boolean]> = [
    ['notifications', isNotification],
    ['dailyReports', isDailyReport],
    ['shifts', isShift]
  ];
  for (const [key, validator] of optionalArrays) {
    if (input[key] !== undefined && (!Array.isArray(input[key]) || !(input[key] as unknown[]).every(validator))) {
      return { ok: false, error: `The optional ${key} collection contains invalid records.` };
    }
  }
  if (input.settings !== undefined && !isSettings(input.settings)) {
    return { ok: false, error: 'Application settings in this backup are invalid.' };
  }
  if (input.exportedAt !== undefined && !isString(input.exportedAt)) {
    return { ok: false, error: 'Backup export timestamp is invalid.' };
  }

  const result: OperationalBackup = {
    schemaVersion: typeof version === 'number' ? version : undefined,
    exportedAt: isString(input.exportedAt) ? input.exportedAt : undefined,
    shuttles: shuttles as Shuttle[],
    batteries: batteries as Battery[],
    faults: faults as Fault[],
    jobs: jobs as MaintenanceJob[],
    notifications: (input.notifications as NotificationItem[] | undefined) || [],
    settings: input.settings as AppSettings | undefined,
    dailyReports: (input.dailyReports as DailyReportSnapshot[] | undefined) || [],
    shifts: (input.shifts as ShiftRecord[] | undefined) || []
  };

  return { ok: true, data: result };
}
