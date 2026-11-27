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
  'Super Admin': ['dashboard', 'warehouse', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'connections', 'notifications', 'users', 'settings'],
  Admin: ['dashboard', 'warehouse', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'connections', 'notifications', 'users', 'settings'],
  Supervisor: ['dashboard', 'warehouse', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'notifications'],
  'Maintenance Engineer': ['dashboard', 'warehouse', 'fleet', 'engineering', 'batteries', 'faults', 'maintenance', 'notifications'],
  Technician: ['dashboard', 'warehouse', 'fleet', 'faults', 'maintenance', 'notifications'],
  Operator: ['dashboard', 'warehouse', 'fleet', 'notifications'],
  Viewer: ['dashboard', 'warehouse', 'fleet']
};

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
