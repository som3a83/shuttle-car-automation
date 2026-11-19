// Fleet seed data uses only facts supplied for this project.
// Unknown identity, specifications and telemetry are deliberately left unverified.
import type {
  Battery,
  CommunicationEndpoint,
  Fault,
  MaintenanceJob,
  NotificationItem,
  ReportSummary,
  Role,
  Shuttle,
  User
} from '../types';

export const users: User[] = [
  { id: 'user-1', name: 'System Administrator', role: 'Super Admin', email: 'admin@local.preview', isAuthenticated: false },
  { id: 'user-2', name: 'Maintenance Engineer', role: 'Maintenance Engineer', email: 'maintenance@local.preview', isAuthenticated: false },
  { id: 'user-3', name: 'Technician', role: 'Technician', email: 'technician@local.preview', isAuthenticated: false }
];

export const rolePermissions: Record<Role, string[]> = {
  'Super Admin': ['dashboard', 'warehouse', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'ai', 'connections', 'reports', 'notifications', 'users', 'settings'],
  Admin: ['dashboard', 'warehouse', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'ai', 'connections', 'reports', 'notifications', 'users', 'settings'],
  Supervisor: ['dashboard', 'warehouse', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'reports', 'notifications'],
  'Maintenance Engineer': ['dashboard', 'warehouse', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'reports', 'notifications'],
  Technician: ['dashboard', 'warehouse', 'fleet', 'faults', 'maintenance', 'notifications'],
  Operator: ['dashboard', 'warehouse', 'fleet', 'notifications'],
  Viewer: ['dashboard', 'warehouse', 'fleet']
};

const unknownAssetFields = {
  model: 'Not recorded',
  serialNumber: 'Not recorded',
  hardwareVersion: 'Not recorded',
  firmwareVersion: 'Not recorded',
  warehouseZone: 'Not recorded',
  status: 'Unknown' as const,
  connectivity: 'UNKNOWN' as const,
  installedBattery: 'Not recorded',
  operatingHours: null,
  operatingCycles: null,
  assignedOperator: 'Not assigned',
  lastCommunication: 'Not connected'
};

export const initialShuttles: Shuttle[] = [
  {
    id: 'SC-01', manufacturer: 'Cassioli', ...unknownAssetFields,
    model: 'ISAT Semi-Automatic',
    faultHistory: [], maintenanceHistory: [],
    notes: 'Installed product family and semi-automatic configuration confirmed by the user. Serial number, exact hardware revision, cold-store variant and telemetry remain unverified.'
  },
  {
    id: 'SC-02', manufacturer: 'Cassioli', ...unknownAssetFields,
    model: 'ISAT Semi-Automatic',
    faultHistory: [], maintenanceHistory: [],
    notes: 'Installed product family and semi-automatic configuration confirmed by the user. Serial number, exact hardware revision, cold-store variant and telemetry remain unverified.'
  },
  {
    id: 'SC-03', manufacturer: 'Cassioli', ...unknownAssetFields,
    model: 'ISAT Semi-Automatic',
    faultHistory: [], maintenanceHistory: [],
    notes: 'Installed product family and semi-automatic configuration confirmed by the user. Serial number, exact hardware revision, cold-store variant and telemetry remain unverified.'
  },
  {
    id: 'SC-04', manufacturer: 'Craftsman', ...unknownAssetFields,
    model: 'Pallet Shuttle (Standard)',
    faultHistory: [],
    maintenanceHistory: [],
    notes: 'Standard Pallet Shuttle model confirmed by the user. Exact model code, serial number, installed options and technical ratings remain unverified. No active fault is pre-registered.'
  },
  {
    id: 'SC-05', manufacturer: 'ACME', ...unknownAssetFields,
    model: 'Namla Polar Edition',
    faultHistory: [],
    maintenanceHistory: [],
    notes: 'Namla Polar Edition confirmed by the user. Exact serial-specific ratings and telemetry remain unverified. Historical report of an ACME HMI 0% display after repair is retained as an unverified note only; it is not an active fault or verified battery reading.'
  }
];

export const initialBatteries: Battery[] = [
  {
    id: 'BAT-ACME-01',
    manufacturer: 'ACME',
    model: 'Not recorded',
    chemistry: 'Not verified',
    nominalVoltage: 'Not recorded',
    capacity: 'Not recorded',
    soc: null,
    soh: null,
    temperature: null,
    voltage: null,
    current: null,
    cycles: null,
    installationDate: 'Not recorded',
    lastMaintenance: 'After repair — date not recorded',
    assignment: 'SC-05',
    notes: 'Historical HMI 0% display was reported after repair. This is an unverified historical observation, not a connected state-of-charge reading; soc remains null until measured through a verified source.',
    status: 'Available',
    connectionMode: 'UNKNOWN'
  }
];

// No open fault is seeded. Only an authorized user can create a current fault record.
export const initialFaults: Fault[] = [];

export const initialMaintenance: MaintenanceJob[] = [];

export const initialNotifications: NotificationItem[] = [];

export const initialConnections: CommunicationEndpoint[] = [
  {
    name: 'Shuttle PLC interface',
    transport: 'ethernet',
    protocol: 'modbus-tcp',
    mode: 'UNKNOWN',
    notes: 'Not configured. Manufacturer register map, address, network and authorization are required.'
  },
  {
    name: 'Industrial controller interface',
    transport: 'ethernet',
    protocol: 'opc-ua',
    mode: 'UNKNOWN',
    notes: 'Not configured. No endpoint or security certificate has been supplied.'
  },
  {
    name: 'Telemetry message bus',
    transport: 'ethernet',
    protocol: 'mqtt',
    mode: 'UNKNOWN',
    notes: 'Not configured. No broker, topic map or credentials are available.'
  },
  {
    name: 'Manufacturer / gateway API',
    transport: 'wifi',
    protocol: 'rest-api',
    mode: 'UNKNOWN',
    notes: 'Not configured. No supported vendor endpoint or documentation is available.'
  },
  {
    name: 'Tablet bridge',
    transport: 'wifi',
    protocol: 'websocket',
    mode: 'UNKNOWN',
    notes: 'Not configured. ACME tablet interface details are not yet verified.'
  },
  {
    name: 'Local service interface',
    transport: 'bluetooth-le',
    protocol: 'ble-gatt',
    mode: 'UNKNOWN',
    notes: 'Not configured. No approved service adapter or pairing procedure is available.'
  }
];

export const initialReports: ReportSummary[] = [
  { title: 'Registered shuttle cars', value: '5', detail: 'Three Cassioli, one Craftsman and one ACME — as reported.' },
  { title: 'Verified live telemetry', value: '0', detail: 'No PLC or manufacturer gateway is connected.' },
  { title: 'Open field reports', value: '0', detail: 'No active fault is registered.' },
  { title: 'Verified battery readings', value: '0', detail: 'Historical ACME HMI report remains unverified; no live reading is available.' }
];

export const defaultSettings = {
  language: 'ar' as const,
  theme: 'dark' as const,
  notificationsEnabled: true,
  maintenanceReminders: true,
  batteryAlerts: true,
  communicationAlerts: true
};
