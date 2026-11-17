import type { Role } from '../types';

export type CustomizableRoute = 'dashboard' | 'fleet' | 'shifts' | 'engineering' | 'batteries' | 'faults' | 'maintenance' | 'connections' | 'ai' | 'reports' | 'notifications' | 'users' | 'settings';

export interface ModulePreference {
  id: CustomizableRoute;
  label: string;
  description: string;
  enabled: boolean;
  hiddenForRoles: Role[];
}

export interface NavigationPreference {
  route: CustomizableRoute;
  label: string;
  group: string;
  visible: boolean;
  order: number;
}

export interface DashboardWidgetPreference {
  id: 'fleet-status' | 'battery-status' | 'faults' | 'maintenance' | 'activity';
  label: string;
  visible: boolean;
  size: 'compact' | 'wide';
  order: number;
}

export interface CustomizationConfig {
  modules: ModulePreference[];
  navigation: NavigationPreference[];
  dashboard: DashboardWidgetPreference[];
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  target: string;
  detail: string;
}

export const DEFAULT_CUSTOMIZATION: CustomizationConfig = {
  modules: [
    ['dashboard', 'Dashboard', 'Fleet summary and local operational indicators.'],
    ['fleet', 'Fleet Control Center', 'Shuttle register and equipment records.'],
    ['shifts', 'Shift Operations & Handover', 'Local shift notes and handover records.'],
    ['engineering', 'Engineering Visualization', 'Representative engineering illustrations.'],
    ['batteries', 'Battery Management', 'Battery records, assignment and lifecycle.'],
    ['faults', 'Fault & Diagnostics', 'Manually recorded fault reports.'],
    ['maintenance', 'Maintenance Management', 'Maintenance plans and work orders.'],
    ['connections', 'Device Connections', 'Read-only integration readiness information.'],
    ['ai', 'AI Technical Assistant', 'Advisory support; does not authorize actions.'],
    ['reports', 'Reports Center', 'Local register reports and exports.'],
    ['notifications', 'Notifications', 'On-device application notifications.'],
    ['users', 'Users & Security', 'Role preview; not authentication or server RBAC.'],
    ['settings', 'System Settings', 'Local application preferences and data backup.']
  ].map(([id, label, description]) => ({ id: id as CustomizableRoute, label, description, enabled: true, hiddenForRoles: [] })),
  navigation: [
    { route: 'dashboard', label: 'Dashboard', group: 'OPERATIONS', visible: true, order: 0 },
    { route: 'fleet', label: 'Fleet Control Center', group: 'OPERATIONS', visible: true, order: 1 },
    { route: 'shifts', label: 'Shift Operations & Handover', group: 'OPERATIONS', visible: true, order: 2 },
    { route: 'engineering', label: 'Engineering Visualization', group: 'ENGINEERING', visible: true, order: 3 },
    { route: 'batteries', label: 'Battery Management', group: 'ENGINEERING', visible: true, order: 4 },
    { route: 'faults', label: 'Fault & Diagnostics', group: 'ENGINEERING', visible: true, order: 5 },
    { route: 'maintenance', label: 'Maintenance Management', group: 'ENGINEERING', visible: true, order: 6 },
    { route: 'connections', label: 'Device Connections', group: 'SYSTEM', visible: true, order: 7 },
    { route: 'ai', label: 'AI Technical Assistant', group: 'SYSTEM', visible: true, order: 8 },
    { route: 'reports', label: 'Reports Center', group: 'SYSTEM', visible: true, order: 9 },
    { route: 'notifications', label: 'Notifications', group: 'SYSTEM', visible: true, order: 10 },
    { route: 'users', label: 'Users & Security', group: 'ADMIN', visible: true, order: 11 },
    { route: 'settings', label: 'System Settings', group: 'ADMIN', visible: true, order: 12 }
  ],
  dashboard: [
    { id: 'fleet-status', label: 'Fleet status', visible: true, size: 'wide', order: 0 },
    { id: 'battery-status', label: 'Battery overview', visible: true, size: 'compact', order: 1 },
    { id: 'faults', label: 'Open fault records', visible: true, size: 'compact', order: 2 },
    { id: 'maintenance', label: 'Maintenance queue', visible: true, size: 'compact', order: 3 },
    { id: 'activity', label: 'Recent local activity', visible: true, size: 'wide', order: 4 }
  ]
};

export const CUSTOMIZATION_STORAGE_KEY = 'shuttle-car-automation-v7:customization';
export const CUSTOMIZATION_AUDIT_KEY = 'shuttle-car-automation-v7:customization-audit';

const cloneDefaults = (): CustomizationConfig => JSON.parse(JSON.stringify(DEFAULT_CUSTOMIZATION)) as CustomizationConfig;

/** Parse saved preference data defensively and keep only known route/widget identifiers. */
export function validateCustomization(input: unknown): CustomizationConfig {
  const defaults = cloneDefaults();
  if (!input || typeof input !== 'object') return defaults;
  const data = input as Partial<CustomizationConfig>;
  const modules = Array.isArray(data.modules) ? data.modules : [];
  const navigation = Array.isArray(data.navigation) ? data.navigation : [];
  const dashboard = Array.isArray(data.dashboard) ? data.dashboard : [];
  return {
    modules: defaults.modules.map((fallback) => {
      const saved = modules.find((item) => item?.id === fallback.id);
      if (!saved) return fallback;
      return { ...fallback, label: text(saved.label, fallback.label), description: text(saved.description, fallback.description), enabled: saved.enabled !== false, hiddenForRoles: Array.isArray(saved.hiddenForRoles) ? saved.hiddenForRoles.filter((role): role is Role => ['Super Admin', 'Admin', 'Supervisor', 'Maintenance Engineer', 'Technician', 'Operator', 'Viewer'].includes(role)) : [] };
    }),
    navigation: defaults.navigation.map((fallback) => {
      const saved = navigation.find((item) => item?.route === fallback.route);
      if (!saved) return fallback;
      return { ...fallback, label: text(saved.label, fallback.label), group: text(saved.group, fallback.group), visible: saved.visible !== false, order: finiteOrder(saved.order, fallback.order) };
    }).sort((a, b) => a.order - b.order),
    dashboard: defaults.dashboard.map((fallback) => {
      const saved = dashboard.find((item) => item?.id === fallback.id);
      if (!saved) return fallback;
      return { ...fallback, visible: saved.visible !== false, size: saved.size === 'wide' ? 'wide' : 'compact', order: finiteOrder(saved.order, fallback.order) };
    }).sort((a, b) => a.order - b.order)
  };
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 80) : fallback;
}

function finiteOrder(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.floor(value))) : fallback;
}

export function loadCustomization(storage: Pick<Storage, 'getItem'> = localStorage): CustomizationConfig {
  try {
    const raw = storage.getItem(CUSTOMIZATION_STORAGE_KEY);
    return raw ? validateCustomization(JSON.parse(raw) as unknown) : cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

export function saveCustomization(config: CustomizationConfig, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(validateCustomization(config)));
}

export function appendCustomizationAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage, now = new Date()): AuditEntry {
  const audit: AuditEntry = { ...entry, id: `AUD-${now.getTime()}`, timestamp: now.toISOString() };
  let previous: AuditEntry[] = [];
  try {
    const parsed: unknown = JSON.parse(storage.getItem(CUSTOMIZATION_AUDIT_KEY) || '[]');
    if (Array.isArray(parsed)) previous = parsed.filter((item): item is AuditEntry => Boolean(item && typeof item === 'object' && typeof item.action === 'string' && typeof item.timestamp === 'string'));
  } catch { /* malformed audit storage is recovered as an empty local log */ }
  storage.setItem(CUSTOMIZATION_AUDIT_KEY, JSON.stringify([audit, ...previous].slice(0, 500)));
  return audit;
}

/** Core screens are protected from being disabled or removed from navigation. */
export const PROTECTED_ROUTES: readonly CustomizableRoute[] = ['dashboard', 'fleet', 'settings'];
