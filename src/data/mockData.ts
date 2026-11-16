// Demonstration seed records only. No values below are verified plant telemetry or vendor specifications.
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
  {
    id: 'user-1',
    name: 'Amina Rahman',
    role: 'Super Admin',
    email: 'admin@shuttleops.local',
    isAuthenticated: true
  },
  {
    id: 'user-2',
    name: 'Omar Haddad',
    role: 'Maintenance Engineer',
    email: 'maintenance@shuttleops.local',
    isAuthenticated: true
  },
  {
    id: 'user-3',
    name: 'Sara Malik',
    role: 'Technician',
    email: 'tech@shuttleops.local',
    isAuthenticated: true
  }
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

export const initialShuttles: Shuttle[] = [
  {
    id: 'SC-101',
    manufacturer: 'Cassioli',
    model: 'Representative Series',
    serialNumber: 'C-101-RT-2026',
    hardwareVersion: 'HV2.1',
    firmwareVersion: 'FW-4.8.2',
    warehouseZone: 'North Transfer Bay',
    status: 'Running',
    connectivity: 'SIMULATION',
    installedBattery: 'BAT-101',
    operatingHours: 4210,
    operatingCycles: 5632,
    faultHistory: ['Wheel slip event', 'Sensor calibration check'],
    maintenanceHistory: ['Quarterly inspection completed'],
    assignedOperator: 'Nabil Hassan',
    lastCommunication: '2026-11-16T08:14:00Z',
    notes: 'Representative industrial shuttle unit for review.'
  },
  {
    id: 'SC-204',
    manufacturer: 'Craftsman',
    model: 'Representative Series',
    serialNumber: 'CFT-204-RT-2026',
    hardwareVersion: 'HV1.7',
    firmwareVersion: 'FW-3.6.1',
    warehouseZone: 'South Pallet Lane',
    status: 'Fault',
    connectivity: 'SIMULATION',
    installedBattery: 'BAT-204',
    operatingHours: 3850,
    operatingCycles: 4912,
    faultHistory: ['Wooden pallet recognition issue', 'False alarm during loading cycle'],
    maintenanceHistory: ['Brake wear inspection booked'],
    assignedOperator: 'Mohammed Ali',
    lastCommunication: '2026-11-15T19:20:00Z',
    notes: 'Reported pallet handling and sensor interruptions; needs technical verification.'
  },
  {
    id: 'SC-311',
    manufacturer: 'ACME',
    model: 'Representative Series',
    serialNumber: 'AC-311-RT-2026',
    hardwareVersion: 'HV3.0',
    firmwareVersion: 'FW-5.0.1',
    warehouseZone: 'Battery Charging Zone',
    status: 'Charging',
    connectivity: 'SIMULATION',
    installedBattery: 'BAT-311',
    operatingHours: 2980,
    operatingCycles: 3850,
    faultHistory: ['Charging current variance'],
    maintenanceHistory: ['Battery inspection completed'],
    assignedOperator: 'Jamal Moubarak',
    lastCommunication: '2026-11-16T07:55:00Z',
    notes: 'Tablet-linked control station is in service for the ACME unit.'
  },
  {
    id: 'SC-418',
    manufacturer: 'Cassioli',
    model: 'Representative Series',
    serialNumber: 'C-418-RT-2026',
    hardwareVersion: 'HV2.2',
    firmwareVersion: 'FW-4.9.0',
    warehouseZone: 'Inspection Line',
    status: 'Idle',
    connectivity: 'OFFLINE',
    installedBattery: 'BAT-418',
    operatingHours: 2760,
    operatingCycles: 3240,
    faultHistory: ['No active faults'],
    maintenanceHistory: ['Routine maintenance acknowledged'],
    assignedOperator: 'Leila Hassan',
    lastCommunication: '2026-11-14T12:10:00Z',
    notes: 'Communication interruption recorded; local diagnostics pending.'
  },
  {
    id: 'SC-519',
    manufacturer: 'Cassioli',
    model: 'Representative Series',
    serialNumber: 'C-519-RT-2026',
    hardwareVersion: 'HV2.3',
    firmwareVersion: 'FW-4.7.9',
    warehouseZone: 'Maintenance Bay',
    status: 'Disconnected',
    connectivity: 'UNKNOWN',
    installedBattery: 'BAT-519',
    operatingHours: 5300,
    operatingCycles: 6215,
    faultHistory: ['Connection lost during transfer'],
    maintenanceHistory: ['Motor test scheduled'],
    assignedOperator: 'Hassan Khatib',
    lastCommunication: '2026-11-13T09:45:00Z',
    notes: 'Remote control device and telemetry link are not verified.'
  }
];

export const initialBatteries: Battery[] = [
  {
    id: 'BAT-101',
    manufacturer: 'Representative (unverified)',
    model: 'Illustrative 48V pack — unverified',
    chemistry: 'Illustrative lithium-ion — unverified',
    nominalVoltage: '48V',
    capacity: '220Ah',
    soc: 81,
    soh: 94,
    temperature: 29,
    voltage: 49.6,
    current: 18,
    cycles: 820,
    installationDate: '2025-09-12',
    lastMaintenance: '2026-11-02',
    assignment: 'SC-101',
    notes: 'Illustrative sample values only. No live battery telemetry is connected.',
    status: 'Installed',
    connectionMode: 'SIMULATION'
  },
  {
    id: 'BAT-204',
    manufacturer: 'BatteryWorks',
    model: 'Lithium 48V Prime',
    chemistry: 'Illustrative lithium-ion — unverified',
    nominalVoltage: '48V',
    capacity: '220Ah',
    soc: 52,
    soh: 86,
    temperature: 37,
    voltage: 45.4,
    current: 24,
    cycles: 980,
    installationDate: '2024-11-22',
    lastMaintenance: '2026-10-29',
    assignment: 'SC-204',
    notes: 'Thermal rise observed; investigation required before extended operation.',
    status: 'Fault',
    connectionMode: 'SIMULATION'
  },
  {
    id: 'BAT-311',
    manufacturer: 'Representative (unverified)',
    model: 'Illustrative 48V pack — unverified',
    chemistry: 'Illustrative lithium-ion — unverified',
    nominalVoltage: '48V',
    capacity: '180Ah',
    soc: 76,
    soh: 91,
    temperature: 30,
    voltage: 48.9,
    current: 15,
    cycles: 720,
    installationDate: '2025-06-14',
    lastMaintenance: '2026-11-03',
    assignment: 'SC-311',
    notes: 'Illustrative sample values only. Charging state is not verified from hardware.',
    status: 'Charging',
    connectionMode: 'SIMULATION'
  },
  {
    id: 'BAT-418',
    manufacturer: 'BatteryWorks',
    model: 'Lithium 48V Prime',
    chemistry: 'Illustrative lithium-ion — unverified',
    nominalVoltage: '48V',
    capacity: '220Ah',
    soc: 65,
    soh: 92,
    temperature: 27,
    voltage: 49.1,
    current: 8,
    cycles: 610,
    installationDate: '2025-02-18',
    lastMaintenance: '2026-09-17',
    assignment: 'SC-418',
    notes: 'Standby reserve unit; current values are nominal.',
    status: 'Available',
    connectionMode: 'OFFLINE'
  },
  {
    id: 'BAT-519',
    manufacturer: 'BatteryWorks',
    model: 'Lithium 48V Prime',
    chemistry: 'Illustrative lithium-ion — unverified',
    nominalVoltage: '48V',
    capacity: '220Ah',
    soc: 44,
    soh: 78,
    temperature: 31,
    voltage: 44.7,
    current: 11,
    cycles: 1140,
    installationDate: '2024-05-09',
    lastMaintenance: '2026-08-15',
    assignment: 'SC-519',
    notes: 'Maintenance investigation pending for capacity retention.',
    status: 'Maintenance',
    connectionMode: 'UNKNOWN'
  }
];

export const initialFaults: Fault[] = [
  {
    id: 'FLT-1001',
    shuttleId: 'SC-204',
    title: 'Wooden pallet recognition anomaly',
    severity: 'Major',
    status: 'Open',
    timestamp: '2026-11-15T18:40:00Z',
    description: 'The route planner misclassified wooden pallet edges and triggered repeated stop warnings.',
    probableCauses: ['Sensor interference', 'Dirty vision field', 'Pallet edge variation'],
    diagnosticProcedure: 'Inspect camera alignment and verify pallet edge detection in low-light conditions.',
    correctiveAction: '',
    assignedTechnician: 'A. Haddad'
  },
  {
    id: 'FLT-1002',
    shuttleId: 'SC-204',
    title: 'Battery drain during load cycle',
    severity: 'Critical',
    status: 'Investigating',
    timestamp: '2026-11-15T16:02:00Z',
    description: 'Battery output dropped faster than expected during a loaded transfer.',
    probableCauses: ['Thermal stress', 'Depth-of-discharge variance', 'Cell imbalance'],
    diagnosticProcedure: 'Review current draw trend and compare against battery health trend before resuming service.',
    correctiveAction: 'Battery pack inspection and thermal scan prior to restart.',
    assignedTechnician: 'J. Karam'
  },
  {
    id: 'FLT-1003',
    shuttleId: 'SC-519',
    title: 'Communication drop on remote control channel',
    severity: 'Major',
    status: 'Open',
    timestamp: '2026-11-13T09:45:00Z',
    description: 'The shuttle lost telemetry feed and reported a channel interruption.',
    probableCauses: ['Link instability', 'Antenna issue', 'Network saturation'],
    diagnosticProcedure: 'Check channel health and remote control handheld connectivity logs.',
    correctiveAction: '',
    assignedTechnician: 'R. Nassar'
  }
];

export const initialMaintenance: MaintenanceJob[] = [
  {
    id: 'MNT-2001',
    shuttleId: 'SC-204',
    title: 'Sensor alignment verification',
    type: 'Corrective',
    status: 'In Progress',
    scheduledDate: '2026-11-17',
    technician: 'A. Haddad',
    notes: 'Check camera mount and image field for pallet recognition.'
  },
  {
    id: 'MNT-2002',
    shuttleId: 'SC-311',
    title: 'Battery maintenance cycle',
    type: 'Preventive',
    status: 'Scheduled',
    scheduledDate: '2026-11-19',
    technician: 'S. Malik',
    notes: 'Inspect thermal performance and charge balance.'
  },
  {
    id: 'MNT-2003',
    shuttleId: 'SC-519',
    title: 'Motor and drive inspection',
    type: 'Preventive',
    status: 'Overdue',
    scheduledDate: '2026-11-10',
    technician: 'Y. Mansour',
    notes: 'Electrical diagnostics and wheel-slip check due.'
  }
];

export const initialNotifications: NotificationItem[] = [
  {
    id: 'N-1',
    title: 'Battery warning',
    detail: 'BAT-204 shows elevated temperature during operation.',
    severity: 'warning',
    time: '8 minutes ago'
  },
  {
    id: 'N-2',
    title: 'Maintenance reminder',
    detail: 'SC-519 requires motor inspection before next dispatch.',
    severity: 'error',
    time: '20 minutes ago'
  },
  {
    id: 'N-3',
    title: 'Communication interruption',
    detail: 'SC-418 is offline and requires review.',
    severity: 'info',
    time: '55 minutes ago'
  }
];

export const initialConnections: CommunicationEndpoint[] = [
  {
    name: 'Fleet PLC Network',
    protocol: 'Modbus TCP',
    mode: 'UNKNOWN',
    notes: 'Placeholder endpoint only. No verified PLC connection or live data source is configured.'
  },
  {
    name: 'Plant MQTT Bus',
    protocol: 'MQTT',
    mode: 'SIMULATION',
    notes: 'Simulation placeholder for interface testing; not connected to a plant broker.'
  },
  {
    name: 'Battery Gateway',
    protocol: 'REST API',
    mode: 'OFFLINE',
    notes: 'Placeholder only. No battery gateway endpoint is configured.'
  },
  {
    name: 'Tablet bridge',
    protocol: 'WebSocket',
    mode: 'UNKNOWN',
    notes: 'Placeholder only. No tablet bridge connection is configured.'
  }
];

export const initialReports: ReportSummary[] = [
  { title: 'Fleet status', value: '95%', detail: 'Stable performance over 24 hours' },
  { title: 'Battery health', value: '89%', detail: 'Average SOH across installed packs' },
  { title: 'Active faults', value: '3', detail: '2 open and 1 under investigation' },
  { title: 'Maintenance backlog', value: '4', detail: 'Including overdue checks' }
];

export const defaultSettings = {
  language: 'en' as const,
  theme: 'dark' as const,
  notificationsEnabled: true,
  maintenanceReminders: true,
  batteryAlerts: true,
  communicationAlerts: true
};
