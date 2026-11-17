import { importOperationalData } from './operationalAdapter';
import { importAuthData } from './authAdapter';
import { importAuditData } from './auditAdapter';
import { importCustomizationData } from './customizationAdapter';
import type { AdapterResult, LegacyReadStorage } from './legacyKeyMap';

export type { AdapterResult, AdapterFamily, LegacyReadStorage, LegacyKeyDefinition } from './legacyKeyMap';
export {
  LEGACY_KEY_MAP,
  listImportableLegacyKeys,
  getLegacyKeyDefinition,
  assertLegacyImportKey,
  OPERATIONAL_LEGACY_KEY_MAP,
  AUTH_LEGACY_KEY_MAP,
  AUDIT_LEGACY_KEY_MAP,
  AUDIT_ARCHIVE_PENDING_LEGACY_KEY,
  EXCLUDED_SESSION_STORAGE_KEY,
  CUSTOMIZATION_LEGACY_KEY_MAP
} from './legacyKeyMap';
export { importOperationalKey, importOperationalData } from './operationalAdapter';
export { importAuthData } from './authAdapter';
export { importAuditData, getPreservedAuditArchivePendingMarker, PRESERVED_AUDIT_PENDING_KEY } from './auditAdapter';
export { importCustomizationData } from './customizationAdapter';

/**
 * Explicit, caller-invoked import entry point. It is never called from app startup.
 * Results are returned per logical storage key so a caller can review conflicts.
 */
export async function importAllLegacyData(
  legacyStorage: LegacyReadStorage = globalThis.localStorage
): Promise<AdapterResult[]> {
  const results: AdapterResult[] = [];
  results.push(...await importOperationalData(legacyStorage));
  results.push(await importAuthData(legacyStorage));
  results.push(...await importAuditData(legacyStorage));
  results.push(...await importCustomizationData(legacyStorage));
  return results;
}
