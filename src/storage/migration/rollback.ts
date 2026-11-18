import { listImportableLegacyKeys } from '../adapters/legacyKeyMap';
import { getStorageModePreference, setStorageModePreference } from '../index';
import {
  deactivateActiveGenerationForRollback,
  getActiveGeneration,
  getGenerationRecordRevisions,
  listGenerationSnapshots,
  type GenerationSnapshot
} from './generation';
import { sha256Canonical } from './verification';

export interface MigrationRollbackAssessment {
  eligible: boolean;
  reason: string | null;
  storageMode: string;
  activeGeneration: string;
  snapshot: GenerationSnapshot | null;
}

type LegacyStorageReader = Pick<Storage, 'getItem'>;

async function legacySourceFingerprint(storage: LegacyStorageReader): Promise<string> {
  const values: Array<{ key: string; raw: string | null }> = [];
  for (const definition of listImportableLegacyKeys()) {
    const raw = storage.getItem(definition.legacyKey);
    if (raw !== null) {
      try {
        JSON.parse(raw) as unknown;
      } catch {
        throw new Error('The preserved legacy source contains invalid JSON for ' + definition.targetKey + '.');
      }
    }
    values.push({ key: definition.legacyKey, raw });
  }
  return sha256Canonical(values);
}

function sameRevisionMap(
  expected: Record<string, number>,
  actual: Record<string, number>
): boolean {
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  return expectedKeys.length > 0 &&
    expectedKeys.length === actualKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index] && expected[key] === actual[key]);
}

/**
 * Rollback is deliberately conservative:
 * - the explicit IndexedDB backend must be active;
 * - the current active generation must be the recorded migration result;
 * - every imported record must still match its post-migration revision;
 * - the approved legacy source must still match the verified migration fingerprint.
 *
 * If any operational write has occurred since migration, rollback is refused.
 */
export async function assessMigrationRollback(
  legacyStorage: LegacyStorageReader = globalThis.localStorage
): Promise<MigrationRollbackAssessment> {
  const storageMode = getStorageModePreference();
  const activeGeneration = await getActiveGeneration();
  if (!legacyStorage || typeof legacyStorage.getItem !== 'function') {
    return { eligible: false, reason: 'The preserved local storage source is not available.', storageMode, activeGeneration, snapshot: null };
  }
  if (storageMode !== 'indexeddb') {
    return { eligible: false, reason: 'Rollback is available only while IndexedDB is the selected storage backend.', storageMode, activeGeneration, snapshot: null };
  }

  const snapshots = await listGenerationSnapshots();
  const snapshot = snapshots.find((item) =>
    item.nextGeneration === activeGeneration && !item.rolledBackAt
  ) ?? null;
  if (!snapshot) {
    return { eligible: false, reason: 'No active, revision-aware migration snapshot matches the current generation.', storageMode, activeGeneration, snapshot: null };
  }
  if (!snapshot.recordRevisions || Object.keys(snapshot.recordRevisions).length !== snapshot.keyCount) {
    return { eligible: false, reason: 'The migration snapshot has no complete post-import revision manifest; rollback cannot be verified.', storageMode, activeGeneration, snapshot };
  }

  const currentRevisions = await getGenerationRecordRevisions(activeGeneration);
  if (!sameRevisionMap(snapshot.recordRevisions, currentRevisions)) {
    return { eligible: false, reason: 'IndexedDB records have changed since migration. Create and verify a normal backup; rollback is disabled to prevent loss of newer data.', storageMode, activeGeneration, snapshot };
  }

  let sourceFingerprint: string;
  try {
    sourceFingerprint = await legacySourceFingerprint(legacyStorage);
  } catch (error) {
    return {
      eligible: false,
      reason: error instanceof Error ? error.message : 'The preserved legacy source could not be verified.',
      storageMode,
      activeGeneration,
      snapshot
    };
  }
  if (sourceFingerprint !== snapshot.sourceFingerprint) {
    return { eligible: false, reason: 'The preserved local storage source no longer matches the migration fingerprint.', storageMode, activeGeneration, snapshot };
  }

  return { eligible: true, reason: null, storageMode, activeGeneration, snapshot };
}

/**
 * Revalidates immediately before the atomic generation deactivation. The legacy
 * values are never deleted or rewritten; after success, reload selects localStorage.
 */
export async function rollbackToLegacyStorage(
  legacyStorage: LegacyStorageReader = globalThis.localStorage
): Promise<{ snapshot: GenerationSnapshot; rollbackGeneration: string }> {
  const assessment = await assessMigrationRollback(legacyStorage);
  if (!assessment.eligible || !assessment.snapshot) {
    throw new Error(assessment.reason || 'The migration is not eligible for rollback.');
  }

  const previousPreference = getStorageModePreference();
  // Persist the next-startup backend before committing the deactivation marker.
  // The live engine stays pinned for this tab; stale writes are blocked atomically
  // by the IndexedDB metadata marker below.
  setStorageModePreference('legacy');
  try {
    return await deactivateActiveGenerationForRollback(
      assessment.snapshot.id,
      assessment.activeGeneration,
      assessment.snapshot.recordRevisions!,
      new Date()
    );
  } catch (error) {
    // Restore the previous startup preference if the IndexedDB transaction aborts.
    try {
      setStorageModePreference(previousPreference === 'legacy' ? 'indexeddb' : previousPreference);
    } catch {
      // The original failure remains primary. The metadata transaction did not commit.
    }
    throw error;
  }
}
