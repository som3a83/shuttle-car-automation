import { importMappedLegacyKey, OPERATIONAL_LEGACY_KEY_MAP, type AdapterResult, type LegacyReadStorage } from './legacyKeyMap';
import type { AppSettings, Language, Theme } from '../../types';

type OperationalLegacyKey = (typeof OPERATIONAL_LEGACY_KEY_MAP)[number]['legacyKey'];

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

  return (value.language === 'ar' || value.language === 'en') &&
    (value.theme === 'dark' || value.theme === 'light') &&
    typeof value.notificationsEnabled === 'boolean' &&
    typeof value.maintenanceReminders === 'boolean' &&
    typeof value.batteryAlerts === 'boolean' &&
    typeof value.communicationAlerts === 'boolean';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isOperationalValue(legacyKey: OperationalLegacyKey, value: unknown): boolean {
  const collection = OPERATIONAL_LEGACY_KEY_MAP.find((entry) => entry.legacyKey === legacyKey)?.legacyKey.split(':').pop();
  if (!collection) return false;
  // Preservation-over-validation policy: legacy collections are preserved as-is once the root is confirmed to be an array.
  // Do not validate individual entries here; stricter item checks could reject valid historical records.
  if (ARRAY_COLLECTIONS.has(collection)) return Array.isArray(value);
  if (collection === 'language') return value === 'ar' || value === 'en';
  if (collection === 'theme') return value === 'dark' || value === 'light';
  if (collection === 'sidebarCollapsed') return typeof value === 'boolean';
  if (collection === 'settings') return isAppSettings(value);
  return false;
}

export async function importOperationalKey(
  legacyKey: OperationalLegacyKey,
  legacyStorage: LegacyReadStorage = globalThis.localStorage
): Promise<AdapterResult> {
  return importMappedLegacyKey(
    legacyKey,
    (value): value is unknown => isOperationalValue(legacyKey, value),
    legacyStorage,
    undefined,
    'operational'
  );
}

/** Imports the twelve operational compatibility keys in a deterministic order. */
export async function importOperationalData(
  legacyStorage: LegacyReadStorage = globalThis.localStorage
): Promise<AdapterResult[]> {
  const results: AdapterResult[] = [];
  for (const entry of OPERATIONAL_LEGACY_KEY_MAP) {
    results.push(await importOperationalKey(entry.legacyKey, legacyStorage));
  }
  return results;
}
