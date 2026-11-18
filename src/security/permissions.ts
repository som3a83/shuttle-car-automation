import type { Role, User } from '../types';

export type Permission =
  | 'dashboard.view'
  | 'fleet.view' | 'fleet.manage'
  | 'engineering.view'
  | 'shifts.view' | 'shifts.manage'
  | 'batteries.view' | 'batteries.manage'
  | 'faults.view' | 'faults.create' | 'faults.update' | 'faults.resolve'
  | 'maintenance.view' | 'maintenance.create' | 'maintenance.update' | 'maintenance.complete'
  | 'connections.view' | 'connections.manage'
  | 'ai.view'
  | 'reports.view' | 'reports.export'
  | 'notifications.view' | 'notifications.manage'
  | 'users.view' | 'users.manage'
  | 'settings.view' | 'settings.manage'
  | 'data.backup' | 'data.restore' | 'data.reset' | 'storage.rollback';

export type ApplicationRoute =
  | 'dashboard' | 'fleet' | 'shifts' | 'engineering' | 'batteries' | 'faults'
  | 'maintenance' | 'connections' | 'ai' | 'reports' | 'notifications' | 'users' | 'settings';

const allPermissions: readonly Permission[] = [
  'dashboard.view', 'fleet.view', 'fleet.manage', 'engineering.view', 'shifts.view', 'shifts.manage',
  'batteries.view', 'batteries.manage', 'faults.view', 'faults.create', 'faults.update', 'faults.resolve',
  'maintenance.view', 'maintenance.create', 'maintenance.update', 'maintenance.complete',
  'connections.view', 'connections.manage', 'ai.view', 'reports.view', 'reports.export',
  'notifications.view', 'notifications.manage', 'users.view', 'users.manage', 'settings.view',
  'settings.manage', 'data.backup', 'data.restore', 'data.reset', 'storage.rollback'
];

const permissionMatrix: Record<Role, readonly Permission[]> = {
  'Super Admin': allPermissions,
  Admin: allPermissions.filter((permission) => permission !== 'data.reset' && permission !== 'storage.rollback'),
  Supervisor: [
    'dashboard.view', 'fleet.view', 'engineering.view', 'shifts.view', 'shifts.manage',
    'batteries.view', 'faults.view', 'faults.create', 'faults.update', 'faults.resolve',
    'maintenance.view', 'maintenance.create', 'maintenance.update', 'maintenance.complete',
    'reports.view', 'reports.export', 'notifications.view', 'notifications.manage', 'data.backup'
  ],
  'Maintenance Engineer': [
    'dashboard.view', 'fleet.view', 'engineering.view', 'batteries.view', 'batteries.manage',
    'faults.view', 'faults.create', 'faults.update', 'faults.resolve',
    'maintenance.view', 'maintenance.create', 'maintenance.update', 'maintenance.complete',
    'reports.view', 'reports.export', 'notifications.view'
  ],
  Technician: [
    'dashboard.view', 'fleet.view', 'engineering.view', 'shifts.view', 'batteries.view',
    'faults.view', 'faults.create', 'faults.update', 'maintenance.view', 'maintenance.update',
    'maintenance.complete', 'notifications.view'
  ],
  Operator: [
    'dashboard.view', 'fleet.view', 'shifts.view', 'shifts.manage', 'batteries.view',
    'faults.view', 'faults.create', 'notifications.view'
  ],
  // Viewer is a safe first-run identity: operational routes are readable, while
  // canPerformAction still requires authentication and an explicit write grant.
  Viewer: [
    'dashboard.view', 'fleet.view', 'engineering.view', 'shifts.view',
    'batteries.view', 'faults.view', 'maintenance.view', 'connections.view',
    'ai.view', 'reports.view', 'notifications.view'
  ]
};

const routePermission: Record<ApplicationRoute, Permission> = {
  dashboard: 'dashboard.view', fleet: 'fleet.view', shifts: 'shifts.view',
  engineering: 'engineering.view', batteries: 'batteries.view', faults: 'faults.view',
  maintenance: 'maintenance.view', connections: 'connections.view', ai: 'ai.view',
  reports: 'reports.view', notifications: 'notifications.view', users: 'users.view', settings: 'settings.view'
};

export function can(role: Role, permission: Permission): boolean {
  return permissionMatrix[role]?.includes(permission) ?? false;
}

export function canAccessRoute(role: Role, route: ApplicationRoute): boolean {
  return can(role, routePermission[route]);
}

/** Mutations require both an authenticated local identity and an allowed role. */
export function canPerformAction(user: Pick<User, 'role' | 'isAuthenticated' | 'mustChangePassword'>, permission: Permission): boolean {
  if (user.isAuthenticated !== true) return false;
  if (user.mustChangePassword && permission !== 'users.manage') return false;
  return can(user.role, permission);
}

export function permissionsFor(role: Role): readonly Permission[] {
  return permissionMatrix[role] ?? [];
}

export function isPermission(value: string): value is Permission {
  return (allPermissions as readonly string[]).includes(value);
}

/**
 * This matrix is an application-level authorization policy. It is useful for
 * offline UI enforcement but is not a security boundary against a user who can
 * modify this device's browser storage or application code.
 */
export const PERMISSION_SECURITY_NOTE =
  'Local role checks are defense-in-depth for the user interface; server-side authorization is required for shared or remote deployments.';
