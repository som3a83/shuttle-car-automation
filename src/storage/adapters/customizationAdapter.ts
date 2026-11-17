import {
  CUSTOMIZATION_LEGACY_KEY_MAP,
  importMappedLegacyKey,
  type AdapterResult,
  type LegacyReadStorage
} from './legacyKeyMap';
import {
  validateCustomization,
  type AuditEntry,
  type CustomizationConfig
} from '../../data/applicationCustomization';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isCustomizationConfig(value: unknown): value is CustomizationConfig {
  return isRecord(value) &&
    Array.isArray(value.modules) &&
    Array.isArray(value.navigation) &&
    Array.isArray(value.dashboard);
}

function isCustomizationAudit(value: unknown): value is AuditEntry[] {
  return Array.isArray(value) && value.every((item) =>
    isRecord(item) &&
    typeof item.id === 'string' &&
    typeof item.timestamp === 'string' &&
    Number.isFinite(Date.parse(item.timestamp)) &&
    typeof item.action === 'string' &&
    typeof item.target === 'string' &&
    typeof item.detail === 'string'
  );
}

/** Imports validated customization data, normalizing only known supported routes/widgets. */
export async function importCustomizationData(
  legacyStorage: LegacyReadStorage = globalThis.localStorage
): Promise<AdapterResult[]> {
  const config = await importMappedLegacyKey(
    CUSTOMIZATION_LEGACY_KEY_MAP.config.legacyKey,
    isCustomizationConfig,
    legacyStorage,
    (value) => validateCustomization(value),
    'customization'
  );
  const audit = await importMappedLegacyKey(
    CUSTOMIZATION_LEGACY_KEY_MAP.audit.legacyKey,
    isCustomizationAudit,
    legacyStorage,
    undefined,
    'customization'
  );
  return [config, audit];
}
