import type { StorageKey } from '../index';
import {
  AUDIT_ARCHIVE_PENDING_LEGACY_KEY,
  EXCLUDED_SESSION_STORAGE_KEY,
  LEGACY_KEY_MAP
} from './legacyKeyMap';

export type LegacyValueTransform = (value: unknown) => unknown;

export interface LegacyKeyResolution {
  legacyKey: string;
  /** Read-only compatibility transform. Writes always persist the caller's exact value. */
  transform?: LegacyValueTransform;
}

function normalizeLegacyShuttles(value: unknown): unknown {
  if (!Array.isArray(value)) return value;

  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;

    const shuttle = item as Record<string, unknown>;
    const isLegacyUnverifiedPlaceholder =
      shuttle.model === 'Not recorded' &&
      shuttle.serialNumber === 'Not recorded' &&
      shuttle.connectivity === 'UNKNOWN' &&
      shuttle.status === 'Unknown';

    if (!isLegacyUnverifiedPlaceholder) return item;
    if (shuttle.operatingHours !== 0 && shuttle.operatingCycles !== 0) return item;

    return {
      ...shuttle,
      ...(shuttle.operatingHours === 0 ? { operatingHours: null } : {}),
      ...(shuttle.operatingCycles === 0 ? { operatingCycles: null } : {})
    };
  });
}

/**
 * Resolves a unified storage key to its existing localStorage key.
 * LEGACY_KEY_MAP remains the single source of truth. Session and pending
 * audit-archive records are deliberately excluded from this storage API.
 */
export function resolveLegacyKey(key: StorageKey | string): LegacyKeyResolution | null {
  if (key === EXCLUDED_SESSION_STORAGE_KEY || key === AUDIT_ARCHIVE_PENDING_LEGACY_KEY) {
    return null;
  }

  const definition = LEGACY_KEY_MAP.find(
    (entry) => entry.importable && entry.targetKey !== null && entry.targetKey === key
  );

  if (!definition || !definition.targetKey) return null;

  return {
    legacyKey: definition.legacyKey,
    ...(definition.targetKey === 'operational.shuttles'
      ? { transform: normalizeLegacyShuttles }
      : {})
  };
}
