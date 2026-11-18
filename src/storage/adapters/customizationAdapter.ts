import {
  CUSTOMIZATION_LEGACY_KEY_MAP,
  importDefaultForMissing,
  importMappedLegacyKey,
  type AdapterResult,
  type LegacyReadStorage
} from './legacyKeyMap';
import type { MigrationStorageContext } from '../index';
import {
  DEFAULT_CUSTOMIZATION,
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
  legacyStorage: LegacyReadStorage = globalThis.localStorage,
  context?: MigrationStorageContext
): Promise<AdapterResult[]> {
  /**
   * ATOMICITY CONSTRAINT (2B-4 dependency):
   *
   * This adapter imports 2 customization keys (config + audit). Each key is
   * written through its own importMappedLegacyKey() call and separate set()
   * operation. If one key is imported but the other returns conflict or
   * failed, the destination store will contain a partial customization dataset.
   *
   * The 2B-1 set() API writes to the ACTIVE generation, not to a staging
   * generation. Therefore 2B-4 (migration orchestrator) MUST NOT call this
   * adapter directly against the active generation. It must use ONE of:
   *
   *   (A) A staging-generation writer that 2B-4 introduces (preferred), OR
   *   (B) A rollback procedure: if this adapter returns partial success,
   *       2B-4 must delete the successfully-imported customization key (via
   *       remove()) before reporting failure to the user, OR
   *   (C) A pre-flight check in 2B-4 that asserts BOTH customization target
   *       keys are ABSENT from the destination before calling this adapter,
   *       so that neither can return already-synced or conflict.
   *
   * This adapter alone cannot guarantee atomicity because the underlying
   * storage API does not support multi-key transactions across keys.
   */
  const configResult = await importMappedLegacyKey(
    CUSTOMIZATION_LEGACY_KEY_MAP.config.legacyKey,
    isCustomizationConfig,
    legacyStorage,
    (value) => validateCustomization(value),
    'customization',
    context
  );
  const auditResult = await importMappedLegacyKey(
    CUSTOMIZATION_LEGACY_KEY_MAP.audit.legacyKey,
    isCustomizationAudit,
    legacyStorage,
    undefined,
    'customization',
    context
  );
  return [
    await importDefaultForMissing(configResult, DEFAULT_CUSTOMIZATION, context),
    await importDefaultForMissing(auditResult, [], context)
  ];
}
