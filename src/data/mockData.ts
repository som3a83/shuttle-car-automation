// Fleet seed data uses only facts supplied for this project.
// Unknown identity, specifications and telemetry are deliberately left unverified.
import type {
  Battery,
  CommunicationEndpoint,
  Fault,
  MaintenanceJob,
  NotificationItem,
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
  'Super Admin': ['dashboard', 'fleet', 'shifts', 'batteries', 'faults', 'maintenance', 'connections', 'notifications', 'users', 'settings'],
  Admin: ['dashboard', 'fleet', 'shifts', 'batteries', 'faults', 'maintenance', 'connections', 'notifications', 'users', 'settings'],
  Supervisor: ['dashboard', 'fleet', 'shifts', 'batteries', 'faults', 'maintenance', 'notifications'],
  'Maintenance Engineer': ['dashboard', 'fleet', 'shifts', 'batteries', 'faults', 'maintenance', 'notifications'],
  Technician: ['dashboard', 'fleet', 'shifts', 'faults', 'maintenance', 'notifications'],
  Operator: ['dashboard', 'fleet', 'shifts', 'notifications'],
  Viewer: ['dashboard', 'fleet', 'shifts']
};

// No equipment, battery or endpoint is pre-registered. Records appear only after a verified discovery or deliberate registration.
export const initialShuttles: Shuttle[] = [];
export const initialBatteries: Battery[] = [];

// No open fault is seeded. Only an authorized user can create a current fault record.
export const initialFaults: Fault[] = [];

export const initialMaintenance: MaintenanceJob[] = [];

export const initialNotifications: NotificationItem[] = [];

export const initialConnections: CommunicationEndpoint[] = [];

export const defaultSettings = {
  language: 'ar' as const,
  theme: 'dark' as const,
  notificationsEnabled: true,
  maintenanceReminders: true,
  batteryAlerts: true,
  communicationAlerts: true
};
