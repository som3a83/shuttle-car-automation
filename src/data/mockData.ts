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
  'Super Admin': ['dashboard', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'ai', 'connections', 'reports', 'notifications', 'users', 'settings'],
  Admin: ['dashboard', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'ai', 'connections', 'reports', 'notifications', 'users', 'settings'],
  Supervisor: ['dashboard', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'reports', 'notifications'],
  'Maintenance Engineer': ['dashboard', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'reports', 'notifications'],
  Technician: ['dashboard', 'fleet', 'faults', 'maintenance', 'notifications'],
  Operator: ['dashboard', 'fleet', 'notifications'],
  Viewer: ['dashboard', 'fleet']
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
    faultHistory: [], maintenanceHistory: [],
    notes: 'Local application ID. Manufacturer serial, model and telemetry have not yet been verified.'
  },
  {
    id: 'SC-02', manufacturer: 'Cassioli', ...unknownAssetFields,
    faultHistory: [], maintenanceHistory: [],
    notes: 'Local application ID. Manufacturer serial, model and telemetry have not yet been verified.'
  },
  {
    id: 'SC-03', manufacturer: 'Cassioli', ...unknownAssetFields,
    faultHistory: [], maintenanceHistory: [],
    notes: 'Local application ID. Manufacturer serial, model and telemetry have not yet been verified.'
  },
  {
    id: 'SC-04', manufacturer: 'Craftsman', ...unknownAssetFields,
    faultHistory: ['Reported pallet recognition, battery drain and stopping anomalies'],
    maintenanceHistory: [],
    notes: 'Reported observations require technical inspection. No root cause or machine telemetry has been confirmed.'
  },
  {
    id: 'SC-05', manufacturer: 'ACME', ...unknownAssetFields,
    faultHistory: ['Battery HMI reportedly displayed 0% after repair'],
    maintenanceHistory: [],
    notes: 'ACME battery was reported at 0% on the HMI after repair. Verify the physical display and battery interface.'
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
    soc: 0,
    soh: null,
    temperature: null,
    voltage: null,
    current: null,
    cycles: null,
    installationDate: 'Not recorded',
    lastMaintenance: 'After repair — date not recorded',
    assignment: 'SC-05',
    notes: 'Reported HMI display was 0% after repair. This is a manually reported observation, not a connected telemetry reading.',
    status: 'Fault',
    connectionMode: 'UNKNOWN'
  }
];

export const initialFaults: Fault[] = [
  {
    id: 'FLT-CRAFTSMAN-01',
    shuttleId: 'SC-04',
    title: 'Multiple operating anomalies reported',
    severity: 'Moderate',
    status: 'Open',
    timestamp: 'Not recorded',
    description: 'Reported observations: wooden pallet recognition issue, rapid battery drain, harsh pallet handling, false alarms, wheel slip on ice, sensor cut-out and sudden stop. Symptoms are not yet independently verified.',
    probableCauses: ['Not established — inspection required'],
    diagnosticProcedure: 'Inspect event logs, sensors, wheel condition and battery behavior under a controlled and approved test procedure.',
    correctiveAction: '',
    assignedTechnician: 'Not assigned'
  }
];

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
  { title: 'Open field reports', value: '1', detail: 'Manual report only; root cause not confirmed.' },
  { title: 'Verified battery readings', value: '0', detail: 'One ACME HMI reading has been reported and needs verification.' }
];

export const defaultSettings = {
  language: 'ar' as const,
  theme: 'dark' as const,
  notificationsEnabled: true,
  maintenanceReminders: true,
  batteryAlerts: true,
  communicationAlerts: true
};
