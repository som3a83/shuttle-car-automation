import type { Role } from '../types';

export type CustomizableRoute = 'dashboard' | 'fleet' | 'shifts' | 'batteries' | 'faults' | 'maintenance' | 'connections' | 'notifications' | 'users' | 'settings';

export interface ModulePreference {
  id: CustomizableRoute;
  label: string;
  description: string;
  enabled: boolean;
  hiddenForRoles: Role[];
}
export interface NavigationPreference {
  /** Stable menu-entry identity. Multiple entries may target the same known route. */
  id: string;
  route: CustomizableRoute;
  label: string;
  labelAr?: string;
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

const ROLES: readonly Role[] = ['Super Admin', 'Admin', 'Supervisor', 'Maintenance Engineer', 'Technician', 'Operator', 'Viewer'];
const ROUTES: readonly CustomizableRoute[] = ['dashboard', 'fleet', 'shifts', 'batteries', 'faults', 'maintenance', 'connections', 'notifications', 'users', 'settings'];

export const DEFAULT_CUSTOMIZATION: CustomizationConfig = {
  modules: [
    ['dashboard', 'Dashboard', 'Fleet summary and local operational indicators.'],
    ['fleet', 'Fleet Control Center', 'Shuttle register and equipment records.'],
    ['shifts', 'Shift Operations & Handover', 'Local shift notes and handover records.'],
    ['batteries', 'Battery Management', 'Battery records, assignment and lifecycle.'],
    ['faults', 'Fault & Diagnostics', 'Manually recorded fault reports.'],
    ['maintenance', 'Maintenance Management', 'Maintenance plans and work orders.'],
    ['connections', 'Device Connections', 'Read-only integration readiness information.'],
    ['notifications', 'Notifications', 'On-device application notifications.'],
    ['users', 'Users & Security', 'Device-local sign-in, local roles and audit integrity.'],
    ['settings', 'System Settings', 'Local application preferences and data backup.']
  ].map(([id, label, description]) => ({ id: id as CustomizableRoute, label, description, enabled: true, hiddenForRoles: [] })),
  navigation: [
    { id:'dashboard', route:'dashboard', label:'Dashboard', labelAr:'لوحة القيادة', group:'OPERATIONS', visible:true, order:0 },
    { id:'fleet', route:'fleet', label:'Fleet Control Center', labelAr:'إدارة الأسطول', group:'OPERATIONS', visible:true, order:1 },
    { id:'shifts', route:'shifts', label:'Shift Operations & Handover', labelAr:'الورديات وتسليم التشغيل', group:'OPERATIONS', visible:true, order:2 },
    { id:'batteries', route:'batteries', label:'Battery Management', labelAr:'إدارة البطاريات', group:'ENGINEERING', visible:true, order:3 },
    { id:'faults', route:'faults', label:'Fault & Diagnostics', labelAr:'الأعطال والتشخيص', group:'ENGINEERING', visible:true, order:5 },
    { id:'maintenance', route:'maintenance', label:'Maintenance Management', labelAr:'إدارة الصيانة', group:'ENGINEERING', visible:true, order:6 },
    { id:'connections', route:'connections', label:'Device Connections', labelAr:'اتصالات المعدات', group:'SYSTEM', visible:true, order:7 },
    { id:'notifications', route:'notifications', label:'Notifications', labelAr:'الإشعارات', group:'SYSTEM', visible:true, order:10 },
    { id:'users', route:'users', label:'Users & Security', labelAr:'المستخدمون والأمان', group:'ADMIN', visible:true, order:11 },
    { id:'settings', route:'settings', label:'System Settings', labelAr:'إعدادات النظام', group:'ADMIN', visible:true, order:12 }
  ],
  dashboard: [
    { id:'fleet-status', label:'Fleet status', visible:true, size:'wide', order:0 },
    { id:'battery-status', label:'Battery overview', visible:true, size:'compact', order:1 },
    { id:'faults', label:'Open fault records', visible:true, size:'compact', order:2 },
    { id:'maintenance', label:'Maintenance queue', visible:true, size:'compact', order:3 },
    { id:'activity', label:'Recent local activity', visible:true, size:'wide', order:4 }
  ]
};

export const CUSTOMIZATION_STORAGE_KEY = 'shuttle-car-automation-v7:customization';
export const CUSTOMIZATION_AUDIT_KEY = 'shuttle-car-automation-v7:customization-audit';
// The async compatibility layer stays on legacy storage until 2B-3c bootstrap
// can switch all application consumers together. Load storage lazily so the
// legacy synchronous functions remain usable from the native Node test runner.
type AsyncCustomizationEngine = import('../storage/index.ts').StorageEngine;
let asyncCustomizationEnginePromise: Promise<AsyncCustomizationEngine> | null = null;
async function getAsyncCustomizationEngine(): Promise<AsyncCustomizationEngine> {
  if (!asyncCustomizationEnginePromise) {
    asyncCustomizationEnginePromise = import('../storage/index.ts').then(({ getStorageEngine }) => getStorageEngine());
  }
  return asyncCustomizationEnginePromise;
}

function isRevisionConflict(reason: unknown): boolean {
  return Boolean(reason && typeof reason === 'object' &&
    'code' in reason && (reason as { code?: unknown }).code === 'STORAGE_CONFLICT');
}
const cloneDefaults = (): CustomizationConfig => JSON.parse(JSON.stringify(DEFAULT_CUSTOMIZATION)) as CustomizationConfig;
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function text(value: unknown, fallback: string, max = 80): string { return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : fallback; }
function finiteOrder(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1000, Math.floor(value))) : fallback; }

/** Defensive local-settings parser. Unknown routes and widgets are discarded. */
export function validateCustomization(input: unknown): CustomizationConfig {
  const defaults = cloneDefaults();
  if (!isRecord(input)) return defaults;
  const rawModules: unknown[] = Array.isArray(input.modules) ? input.modules : [];
  const rawNavigation: unknown[] = Array.isArray(input.navigation) ? input.navigation : [];
  const rawDashboard: unknown[] = Array.isArray(input.dashboard) ? input.dashboard : [];

  const modules = defaults.modules.map((fallback) => {
    const saved = rawModules.find((item) => isRecord(item) && item.id === fallback.id);
    if (!isRecord(saved)) return fallback;
    const protectedRoute = PROTECTED_ROUTES.includes(fallback.id);
    const roles = Array.isArray(saved.hiddenForRoles) ? saved.hiddenForRoles.filter((role): role is Role => ROLES.includes(role as Role)) : [];
    return {
      ...fallback,
      label: text(saved.label, fallback.label),
      description: text(saved.description, fallback.description, 160),
      enabled: protectedRoute ? true : saved.enabled !== false,
      hiddenForRoles: protectedRoute ? [] : roles
    };
  });

  const navigation = defaults.navigation.map((fallback) => {
    const saved = rawNavigation.find((item) => isRecord(item) && (item.id === fallback.id || (typeof item.id !== 'string' && item.route === fallback.route)));
    if (!isRecord(saved)) return fallback;
    return {
      ...fallback,
      label: text(saved.label, fallback.label),
      labelAr: text(saved.labelAr, fallback.labelAr || fallback.label),
      group: text(saved.group, fallback.group, 40),
      visible: PROTECTED_ROUTES.includes(fallback.route) ? true : saved.visible !== false,
      order: finiteOrder(saved.order, fallback.order)
    };
  });

  const knownIds = new Set(navigation.map((item) => item.id));
  const aliases: NavigationPreference[] = [];
  rawNavigation.forEach((item, index) => {
    if (!isRecord(item) || typeof item.route !== 'string' || !ROUTES.includes(item.route as CustomizableRoute)) return;
    const id = text(item.id, '', 100);
    if (!id || ROUTES.includes(id as CustomizableRoute) || knownIds.has(id)) return;
    const module = modules.find((entry) => entry.id === item.route);
    if (!module?.enabled) return;
    knownIds.add(id);
    aliases.push({
      id, route: item.route as CustomizableRoute,
      label: text(item.label, String(item.route)),
      labelAr: text(item.labelAr, text(item.label, String(item.route))),
      group: text(item.group, 'CUSTOM', 40),
      visible: item.visible !== false,
      order: finiteOrder(item.order, navigation.length + index)
    });
  });

  const dashboard = defaults.dashboard.map((fallback) => {
    const saved = rawDashboard.find((item) => isRecord(item) && item.id === fallback.id);
    if (!isRecord(saved)) return fallback;
    return { ...fallback, visible: saved.visible !== false, size: saved.size === 'wide' ? 'wide' as const : 'compact' as const, order: finiteOrder(saved.order, fallback.order) };
  });

  return {
    modules,
    navigation: [...navigation, ...aliases].sort((a, b) => a.order - b.order),
    dashboard: dashboard.sort((a, b) => a.order - b.order)
  };
}

export function loadCustomization(storage: Pick<Storage, 'getItem'> = localStorage): CustomizationConfig {
  try {
    const raw = storage.getItem(CUSTOMIZATION_STORAGE_KEY);
    return raw ? validateCustomization(JSON.parse(raw) as unknown) : cloneDefaults();
  } catch { return cloneDefaults(); }
}
export function saveCustomization(config: CustomizationConfig, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(CUSTOMIZATION_STORAGE_KEY, JSON.stringify(validateCustomization(config)));
}
export function readCustomizationAudit(storage: Pick<Storage, 'getItem'> = localStorage): AuditEntry[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(CUSTOMIZATION_AUDIT_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is AuditEntry => isRecord(item) && typeof item.id === 'string' && typeof item.timestamp === 'string' && typeof item.action === 'string' && typeof item.target === 'string' && typeof item.detail === 'string').slice(0, 500);
  } catch { return []; }
}
export function appendCustomizationAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage, now = new Date()): AuditEntry {
  const audit: AuditEntry = { ...entry, id: `AUD-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: now.toISOString() };
  storage.setItem(CUSTOMIZATION_AUDIT_KEY, JSON.stringify([audit, ...readCustomizationAudit(storage)].slice(0, 500)));
  return audit;
}


/** Async load counterpart used by the backend-driven customization screen. */
export async function loadCustomizationAsync(): Promise<CustomizationConfig> {
  const engine = await getAsyncCustomizationEngine();
  const stored = await engine.read('customization.config');
  return validateCustomization(stored?.value ?? cloneDefaults());
}

/** Async save uses the revision sidecar and refuses to overwrite a newer edit. */
export async function saveCustomizationAsync(config: CustomizationConfig): Promise<void> {
  const normalized = validateCustomization(config);
  const engine = await getAsyncCustomizationEngine();
  const current = await engine.read('customization.config');
  await engine.write('customization.config', normalized, current?.revision ?? 0);
}

function validCustomizationAuditEntries(value: unknown): AuditEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AuditEntry =>
    isRecord(item) &&
    typeof item.id === 'string' &&
    typeof item.timestamp === 'string' &&
    typeof item.action === 'string' &&
    typeof item.target === 'string' &&
    typeof item.detail === 'string'
  ).slice(0, 500);
}

/** Async audit read retains the existing entry validation and 500-item limit. */
export async function readCustomizationAuditAsync(): Promise<AuditEntry[]> {
  const engine = await getAsyncCustomizationEngine();
  const stored = await engine.read('customization.audit');
  return validCustomizationAuditEntries(stored?.value ?? []);
}

/** Async audit append retries revision conflicts without dropping concurrent entries. */
export async function appendCustomizationAuditAsync(
  entry: Omit<AuditEntry, 'id' | 'timestamp'>,
  now = new Date()
): Promise<AuditEntry> {
  const audit: AuditEntry = {
    ...entry,
    id: `AUD-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now.toISOString()
  };

  const engine = await getAsyncCustomizationEngine();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await engine.read('customization.audit');
    const existing = validCustomizationAuditEntries(current?.value ?? []);
    try {
      await engine.write(
        'customization.audit',
        [audit, ...existing].slice(0, 500),
        current?.revision ?? 0
      );
      return audit;
    } catch (reason) {
      if (!isRevisionConflict(reason)) throw reason;
      if (attempt === 2) throw new Error('CUSTOMIZATION_AUDIT_APPEND_FAILED_AFTER_RETRIES');
    }
  }
  throw new Error('CUSTOMIZATION_AUDIT_APPEND_FAILED_AFTER_RETRIES');
}

/** Core operational routes cannot be disabled or hidden from the navigation. */
export const PROTECTED_ROUTES: readonly CustomizableRoute[] = ['dashboard', 'fleet', 'users', 'settings'];
