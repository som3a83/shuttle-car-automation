export type Language = 'en' | 'ar';
export type Theme = 'dark' | 'light';
export type Role =
  | 'Super Admin'
  | 'Admin'
  | 'Supervisor'
  | 'Maintenance Engineer'
  | 'Technician'
  | 'Operator'
  | 'Viewer';

export type ShuttleStatus =
  | 'Ready'
  | 'Running'
  | 'Idle'
  | 'Charging'
  | 'Maintenance'
  | 'Fault'
  | 'Disconnected'
  | 'Unknown';

export type ConnectivityStatus = 'REAL' | 'SIMULATION' | 'OFFLINE' | 'UNKNOWN';
export type FaultSeverity = 'Critical' | 'Major' | 'Moderate' | 'Minor';
export type FaultStatus = 'Open' | 'Investigating' | 'Resolved';
export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue';

export interface User {
  id: string;
  name: string;
  role: Role;
  email: string;
  isAuthenticated: boolean;
  mustChangePassword?: boolean;
}

export interface Shuttle {
  /** Application-local identifier; not the manufacturer's serial number. */
  id: string;
  manufacturer: string;
  /** Soft archive retains fault and maintenance history without showing the unit as active. */
  archivedAt?: string | null;
  model: string;
  serialNumber: string;
  hardwareVersion: string;
  firmwareVersion: string;
  warehouseZone: string;
  status: ShuttleStatus;
  connectivity: ConnectivityStatus;
  installedBattery: string;
  operatingHours: number | null;
  operatingCycles: number | null;
  faultHistory: string[];
  maintenanceHistory: string[];
  assignedOperator: string;
  lastCommunication: string;
  notes: string;
}

export type BatteryMovementAction = 'Registered' | 'Assigned' | 'Removed' | 'Reassigned' | 'Archived' | 'Restored';

export interface BatteryMovement {
  id: string;
  timestamp: string;
  action: BatteryMovementAction;
  fromShuttleId: string;
  toShuttleId: string;
  note: string;
  source: 'MANUAL';
}

export interface ShiftRecord {
  id: string;
  shiftType: 'Day' | 'Night';
  startedAt: string;
  endedAt: string | null;
  supervisor: string;
  operators: string;
  openingNotes: string;
  handoverNotes: string;
  openingFleet: Array<{ id: string; manufacturer: string; status: ShuttleStatus; connectivity: ConnectivityStatus }>;
  closingFleet: Array<{ id: string; manufacturer: string; status: ShuttleStatus; connectivity: ConnectivityStatus }>;
  openingOpenFaults: number;
  closingOpenFaults: number | null;
  openingOpenMaintenance: number;
  closingOpenMaintenance: number | null;
}

export interface Battery {
  id: string;
  /** Soft archive preserves battery history and prevents accidental permanent data loss. */
  archivedAt?: string | null;
  manufacturer: string;
  model: string;
  chemistry: string;
  nominalVoltage: string;
  capacity: string;
  /** Null means not measured / not verified, not zero percent. */
  soc: number | null;
  soh: number | null;
  temperature: number | null;
  voltage: number | null;
  current: number | null;
  cycles: number | null;
  installationDate: string;
  lastMaintenance: string;
  assignment: string;
  notes: string;
  status: 'Installed' | 'Spare' | 'Charging' | 'Discharging' | 'Available' | 'Maintenance' | 'Fault';
  connectionMode: ConnectivityStatus;
  /** Local manual movement history; does not represent BMS telemetry. */
  movementHistory?: BatteryMovement[];
}

export interface Fault {
  id: string;
  /** Soft archive retains the original report and its corrective-action history. */
  archivedAt?: string | null;
  shuttleId: string;
  title: string;
  severity: FaultSeverity;
  status: FaultStatus;
  timestamp: string;
  description: string;
  probableCauses: string[];
  diagnosticProcedure: string;
  correctiveAction?: string;
  assignedTechnician: string;
}

export interface MaintenanceJob {
  id: string;
  /** Soft archive is permitted only after a work order is completed. */
  archivedAt?: string | null;
  shuttleId: string;
  title: string;
  type: 'Preventive' | 'Corrective';
  status: MaintenanceStatus;
  scheduledDate: string;
  technician: string;
  notes: string;
  /** Recorded result required by the application completion workflow; optional for legacy backups. */
  completionNotes?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'error';
  time: string;
}

export interface CommunicationEndpoint {
  /** Soft archive retains endpoint configuration history. */
  archivedAt?: string | null;
  name: string;
  /** Physical/link transport; vendor-specific identifiers are intentionally supported. */
  transport?: string;
  /** Protocol identifier; never restrict this to a fixed manufacturer list. */
  protocol: string;
  mode: ConnectivityStatus;
  notes: string;
}

export interface ReportSummary {
  title: string;
  value: string;
  detail: string;
}

export interface AppSettings {
  language: Language;
  theme: Theme;
  notificationsEnabled: boolean;
  maintenanceReminders: boolean;
  batteryAlerts: boolean;
  communicationAlerts: boolean;
}


export interface DailyReportSnapshot {
  id: string;
  reportDate: string;
  generatedAt: string;
  shuttleCount: number;
  runningCount: number;
  readyCount: number;
  disconnectedCount: number;
  openFaultCount: number;
  openMaintenanceCount: number;
  batteryCount: number;
  faultedBatteryCount: number;
  verifiedTelemetryCount: number;
  /** Optional for backwards compatibility with snapshots created before shift tracking. */
  activeShift?: { id: string; shiftType: 'Day' | 'Night'; supervisor: string; startedAt: string } | null;
  shuttles: Array<{
    id: string;
    manufacturer: string;
    status: ShuttleStatus;
    connectivity: ConnectivityStatus;
    warehouseZone: string;
  }>;
  batteries: Array<{
    id: string;
    manufacturer: string;
    status: Battery['status'];
    assignment: string;
    soc: number | null;
    connectionMode: ConnectivityStatus;
    movementHistory?: BatteryMovement[];
  }>;
}
