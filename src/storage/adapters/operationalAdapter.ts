import { importDefaultForMissing, importMappedLegacyKey, OPERATIONAL_LEGACY_KEY_MAP, type AdapterResult, type LegacyReadStorage } from './legacyKeyMap';
import type { MigrationStorageContext } from '../index';
import type { AppSettings, Language, Theme } from '../../types';

type OperationalLegacyKey = (typeof OPERATIONAL_LEGACY_KEY_MAP)[number]['legacyKey'];

export const OPERATIONAL_DEFAULTS: Record<OperationalLegacyKey, unknown> = {
  'shuttle-car-automation-v7:language': 'en',
  'shuttle-car-automation-v7:theme': 'light',
  'shuttle-car-automation-v7:sidebarCollapsed': false,
  'shuttle-car-automation-v7:shuttles': [],
  'shuttle-car-automation-v7:batteries': [],
  'shuttle-car-automation-v7:faults': [],
  'shuttle-car-automation-v7:maintenance': [],
  'shuttle-car-automation-v7:connections': [],
  'shuttle-car-automation-v7:notifications': [],
  'shuttle-car-automation-v7:settings': {
    language: 'en',
    theme: 'light',
    notificationsEnabled: true,
    maintenanceReminders: true,
    batteryAlerts: true,
    communicationAlerts: true
  } satisfies AppSettings,
  'shuttle-car-automation-v7:dailyReports': [],
  'shuttle-car-automation-v7:shifts': []
};

const ARRAY_COLLECTIONS = new Set([
  'shuttles', 'batteries', 'faults', 'maintenance', 'connections',
  'notifications', 'dailyReports', 'shifts'
]);

const APP_SETTINGS_FIELDS = [
  'language', 'theme', 'notificationsEnabled', 'maintenanceReminders',
  'batteryAlerts', 'communicationAlerts'
] as const satisfies readonly (keyof AppSettings)[];

// Compile-time guard: this list must cover every declared AppSettings field.
type AppSettingsFieldsAreComplete =
  Exclude<keyof AppSettings, (typeof APP_SETTINGS_FIELDS)[number]> extends never ? true : never;
const appSettingsFieldsAreComplete: AppSettingsFieldsAreComplete = true;
void appSettingsFieldsAreComplete;

function isAppSettings(value: unknown): value is AppSettings {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== APP_SETTINGS_FIELDS.length ||
      keys.some((key) => !APP_SETTINGS_FIELDS.includes(key as (typeof APP_SETTINGS_FIELDS)[number]))) {
    return false;
  }

  return isLanguage(value.language) &&
    isTheme(value.theme) &&
    typeof value.notificationsEnabled === 'boolean' &&
    typeof value.maintenanceReminders === 'boolean' &&
    typeof value.batteryAlerts === 'boolean' &&
    typeof value.communicationAlerts === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ar';
}

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

function isOperationalValue(legacyKey: OperationalLegacyKey, value: unknown): boolean {
  const collection = OPERATIONAL_LEGACY_KEY_MAP.find((entry) => entry.legacyKey === legacyKey)?.legacyKey.split(':').pop();
  if (!collection) return false;
  // Preservation-over-validation policy: legacy collections are preserved as-is once the root is confirmed to be an array.
  // Do not validate individual entries here; stricter item checks could reject valid historical records.
  if (ARRAY_COLLECTIONS.has(collection)) return Array.isArray(value);
  if (collection === 'language') return isLanguage(value);
  if (collection === 'theme') return isTheme(value);
  if (collection === 'sidebarCollapsed') return typeof value === 'boolean';
  if (collection === 'settings') return isAppSettings(value);
  return false;
}

export async function importOperationalKey(
  legacyKey: OperationalLegacyKey,
  legacyStorage: LegacyReadStorage = globalThis.localStorage,
  context?: MigrationStorageContext
): Promise<AdapterResult> {
  const result = await importMappedLegacyKey(
    legacyKey,
    (value): value is unknown => isOperationalValue(legacyKey, value),
    legacyStorage,
    undefined,
    'operational',
    context
  );
  return importDefaultForMissing(result, OPERATIONAL_DEFAULTS[legacyKey], context);
}

/** Imports the twelve operational compatibility keys in a deterministic order. */
export async function importOperationalData(
  legacyStorage: LegacyReadStorage = globalThis.localStorage,
  context?: MigrationStorageContext
): Promise<AdapterResult[]> {
  /**
   * ATOMICITY CONSTRAINT (2B-4 dependency):
   *
   * This adapter imports 12 operational keys. Each key is written through its
   * own importMappedLegacyKey() call and separate set() operation. If a later
   * key returns conflict or failed after earlier keys were imported, the
   * destination store will contain a partial operational dataset.
   *
   * The 2B-1 set() API writes to the ACTIVE generation, not to a staging
   * generation. Therefore 2B-4 (migration orchestrator) MUST NOT call this
   * adapter directly against the active generation. It must use ONE of:
   *
   *   (A) A staging-generation writer that 2B-4 introduces (preferred), OR
   *   (B) A rollback procedure: if this adapter returns partial success,
   *       2B-4 must delete every successfully-imported operational key (via
   *       remove()) before reporting failure to the user, OR
   *   (C) A pre-flight check in 2B-4 that asserts ALL 12 operational target
   *       keys are ABSENT from the destination before calling this adapter,
   *       so that no key can return already-synced or conflict.
   *
   * This adapter alone cannot guarantee atomicity because the underlying
   * storage API does not support multi-key transactions across keys.
   */
  const results: AdapterResult[] = [];
  for (const entry of OPERATIONAL_LEGACY_KEY_MAP) {
    results.push(await importOperationalKey(entry.legacyKey, legacyStorage, context));
  }
  return results;
}
