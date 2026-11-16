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
}

export interface Shuttle {
  /** Application-local identifier; not the manufacturer's serial number. */
  id: string;
  manufacturer: 'Cassioli' | 'Craftsman' | 'ACME';
  model: string;
  serialNumber: string;
  hardwareVersion: string;
  firmwareVersion: string;
  warehouseZone: string;
  status: ShuttleStatus;
  connectivity: ConnectivityStatus;
  installedBattery: string;
  operatingHours: number;
  operatingCycles: number;
  faultHistory: string[];
  maintenanceHistory: string[];
  assignedOperator: string;
  lastCommunication: string;
  notes: string;
}

export interface Battery {
  id: string;
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
}

export interface Fault {
  id: string;
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
  shuttleId: string;
  title: string;
  type: 'Preventive' | 'Corrective';
  status: MaintenanceStatus;
  scheduledDate: string;
  technician: string;
  notes: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'warning' | 'error';
  time: string;
}

export interface CommunicationEndpoint {
  name: string;
  protocol: 'Modbus TCP' | 'OPC UA' | 'MQTT' | 'REST API' | 'WebSocket' | 'BLE';
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
