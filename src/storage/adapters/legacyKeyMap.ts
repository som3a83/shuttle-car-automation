import { StorageError, getWithRevision, set, type StorageKey } from '../index';

export type AdapterFamily = 'operational' | 'auth' | 'audit' | 'customization';
export interface LegacyKeyDefinition { legacyKey: string; adapter: AdapterFamily | 'audit-marker'; targetKey: StorageKey | null; importable: boolean; }
export type AdapterResult<T = unknown> =
  | { status: 'imported'; key: string; value: T; recordsCount: number; note?: string }
  | { status: 'already-synced'; key: string; recordsCount: number }
  | { status: 'conflict'; key: string; legacyValue: unknown; existingValue: unknown; message: string }
  | { status: 'missing-source'; key: string }
  | { status: 'invalid-source'; key: string; message: string }
  | { status: 'failed'; key: string; message: string; errorCode?: string };
export interface LegacyReadStorage { getItem(key: string): string | null; }

export const OPERATIONAL_LEGACY_KEY_MAP = [
  { legacyKey: 'shuttle-car-automation-v7:language', targetKey: 'operational.language' },
  { legacyKey: 'shuttle-car-automation-v7:theme', targetKey: 'operational.theme' },
  { legacyKey: 'shuttle-car-automation-v7:sidebarCollapsed', targetKey: 'operational.sidebarCollapsed' },
  { legacyKey: 'shuttle-car-automation-v7:shuttles', targetKey: 'operational.shuttles' },
  { legacyKey: 'shuttle-car-automation-v7:batteries', targetKey: 'operational.batteries' },
  { legacyKey: 'shuttle-car-automation-v7:faults', targetKey: 'operational.faults' },
  { legacyKey: 'shuttle-car-automation-v7:maintenance', targetKey: 'operational.maintenance' },
  { legacyKey: 'shuttle-car-automation-v7:connections', targetKey: 'operational.connections' },
  { legacyKey: 'shuttle-car-automation-v7:notifications', targetKey: 'operational.notifications' },
  { legacyKey: 'shuttle-car-automation-v7:settings', targetKey: 'operational.settings' },
  { legacyKey: 'shuttle-car-automation-v7:dailyReports', targetKey: 'operational.dailyReports' },
  { legacyKey: 'shuttle-car-automation-v7:shifts', targetKey: 'operational.shifts' }
] as const satisfies readonly { legacyKey: string; targetKey: StorageKey }[];

export const AUTH_LEGACY_KEY_MAP = {
  accounts: { legacyKey: 'shuttle-car-automation-v1:local-accounts', targetKey: 'auth.accounts' as const }
} as const;
export const AUDIT_LEGACY_KEY_MAP = {
  active: { legacyKey: 'shuttle-car-automation-v1:audit-log', targetKey: 'audit.active' as const },
  archives: { legacyKey: 'shuttle-car-automation-v1:audit-archives', targetKey: 'audit.archives' as const }
} as const;
export const AUDIT_ARCHIVE_PENDING_LEGACY_KEY = 'shuttle-car-automation-v1:audit-archive-pending';
export const EXCLUDED_SESSION_STORAGE_KEY = 'shuttle-car-automation-v1:session';
export const CUSTOMIZATION_LEGACY_KEY_MAP = {
  config: { legacyKey: 'shuttle-car-automation-v7:customization', targetKey: 'customization.config' as const },
  audit: { legacyKey: 'shuttle-car-automation-v7:customization-audit', targetKey: 'customization.audit' as const }
} as const;

export const LEGACY_KEY_MAP: readonly LegacyKeyDefinition[] = [
  ...OPERATIONAL_LEGACY_KEY_MAP.map((entry) => ({ ...entry, adapter: 'operational' as const, importable: true })),
  { ...AUTH_LEGACY_KEY_MAP.accounts, adapter: 'auth', importable: true },
  { ...AUDIT_LEGACY_KEY_MAP.active, adapter: 'audit', importable: true },
  { ...AUDIT_LEGACY_KEY_MAP.archives, adapter: 'audit', importable: true },
  { legacyKey: AUDIT_ARCHIVE_PENDING_LEGACY_KEY, adapter: 'audit-marker', targetKey: null, importable: false },
  { ...CUSTOMIZATION_LEGACY_KEY_MAP.config, adapter: 'customization', importable: true },
  { ...CUSTOMIZATION_LEGACY_KEY_MAP.audit, adapter: 'customization', importable: true }
];

export function listImportableLegacyKeys(): readonly LegacyKeyDefinition[] {
  return LEGACY_KEY_MAP.filter((entry) => entry.importable);
}
export function getLegacyKeyDefinition(legacyKey: string): LegacyKeyDefinition | undefined {
  return LEGACY_KEY_MAP.find((entry) => entry.legacyKey === legacyKey);
}
export function assertLegacyImportKey(legacyKey: string, expectedAdapter?: AdapterFamily): LegacyKeyDefinition {
  if (typeof legacyKey !== 'string' || legacyKey.trim().length === 0) throw new TypeError('A non-empty approved legacy key is required.');
  const definition = getLegacyKeyDefinition(legacyKey);
  if (!definition || !definition.importable || !definition.targetKey) throw new Error('Legacy key is not approved for import.');
  if (expectedAdapter && definition.adapter !== expectedAdapter) throw new Error('Legacy key does not belong to the requested adapter.');
  return definition;
}
export function countRecords(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return value === null || value === undefined ? 0 : 1;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
function valuesEqual(left: unknown, right: unknown): boolean {
  try { return canonical(left) === canonical(right); } catch { return false; }
}
function safeErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message.slice(0, 300) : fallback;
}

/** Imports one allow-listed legacy key. Conflicts/invalid data are results; legacy bytes are never changed. */
export async function importMappedLegacyKey<T>(
  legacyKey: string,
  validator: (value: unknown) => value is T,
  legacyStorage: LegacyReadStorage = globalThis.localStorage,
  normalize?: (value: T) => T,
  expectedAdapter?: AdapterFamily
): Promise<AdapterResult<T>> {
  const definition = assertLegacyImportKey(legacyKey, expectedAdapter);
  if (typeof validator !== 'function') throw new TypeError('A legacy value validator is required.');
  if (!legacyStorage || typeof legacyStorage.getItem !== 'function') throw new TypeError('A readable legacy storage object is required.');
  const key = definition.targetKey as StorageKey;

  let raw: string | null;
  try { raw = legacyStorage.getItem(legacyKey); }
  catch (error) { return { status: 'failed', key, message: safeErrorMessage(error, 'Legacy source could not be read.') }; }
  if (raw === null) return { status: 'missing-source', key };

  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; }
  catch { return { status: 'invalid-source', key, message: 'Legacy source is not valid JSON.' }; }

  let value: T;
  try {
    if (!validator(parsed)) return { status: 'invalid-source', key, message: 'Legacy source does not match the approved data shape.' };
    value = normalize ? normalize(parsed) : parsed;
  } catch {
    return { status: 'invalid-source', key, message: 'Legacy source failed validation or normalization.' };
  }
  const recordsCount = countRecords(value);

  let current;
  try { current = await getWithRevision(key); }
  catch (error) {
    return { status: 'failed', key, message: safeErrorMessage(error, 'Current storage value could not be read.'), ...(error instanceof StorageError ? { errorCode: error.code } : {}) };
  }
  if (current) {
    if (valuesEqual(current.value, value)) return { status: 'already-synced', key, recordsCount };
    return { status: 'conflict', key, legacyValue: value, existingValue: current.value, message: 'A different value already exists in the new store. No value was overwritten.' };
  }

  try {
    await set(key, value as never, 0);
    return { status: 'imported', key, value, recordsCount };
  } catch (error) {
    if (error instanceof StorageError && error.code === 'STORAGE_CONFLICT') {
      let latest;
      try { latest = await getWithRevision(key); }
      catch (readError) {
        return { status: 'failed', key, message: safeErrorMessage(readError, 'Storage changed during import and could not be re-read.'), errorCode: 'STORAGE_TRANSACTION_FAILED' };
      }
      if (latest && valuesEqual(latest.value, value)) return { status: 'already-synced', key, recordsCount };
      return { status: 'conflict', key, legacyValue: value, existingValue: latest?.value, message: 'A concurrent write created a different value. No automatic merge was attempted.' };
    }
    return { status: 'failed', key, message: safeErrorMessage(error, 'Legacy import could not be committed.'), ...(error instanceof StorageError ? { errorCode: error.code } : {}) };
  }
}

/**
 * Applies an approved default only when the legacy source key is absent.
 * Existing destination values are never overwritten.
 */
export async function importDefaultForMissing<T>(
  result: AdapterResult<T>,
  defaultValue: T
): Promise<AdapterResult<T>> {
  if (result.status !== 'missing-source') return result;
  const key = result.key as StorageKey;
  const recordsCount = countRecords(defaultValue);

  try {
    const current = await getWithRevision(key);
    if (current) {
      if (valuesEqual(current.value, defaultValue)) {
        return { status: 'already-synced', key, recordsCount };
      }
      return {
        status: 'conflict',
        key,
        legacyValue: defaultValue,
        existingValue: current.value,
        message: 'The legacy source is missing and a different destination value already exists. No value was overwritten.'
      };
    }
    await set(key, defaultValue as never, 0);
    return { status: 'imported', key, value: defaultValue, recordsCount, note: 'default value used' };
  } catch (error) {
    return {
      status: 'failed',
      key,
      message: safeErrorMessage(error, 'The default value could not be committed.'),
      ...(error instanceof StorageError ? { errorCode: error.code } : {})
    };
  }
}

/** Reads the pending audit marker without parsing, moving, or clearing it. */
export function readAuditArchivePendingMarker(legacyStorage: LegacyReadStorage = globalThis.localStorage): string | null {
  if (!legacyStorage || typeof legacyStorage.getItem !== 'function') throw new TypeError('A readable legacy storage object is required.');
  return legacyStorage.getItem(AUDIT_ARCHIVE_PENDING_LEGACY_KEY);
}
