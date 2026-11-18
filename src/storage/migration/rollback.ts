import {
  CUSTOMIZATION_LEGACY_KEY_MAP,
  AUTH_LEGACY_KEY_MAP,
  AUDIT_LEGACY_KEY_MAP,
  listImportableLegacyKeys,
  readAuditArchivePendingMarker
} from '../adapters/legacyKeyMap';
import { OPERATIONAL_LEGACY_KEY_MAP } from '../adapters/legacyKeyMap';
import { OPERATIONAL_DEFAULTS } from '../adapters/operationalAdapter';
import { DEFAULT_CUSTOMIZATION } from '../../data/applicationCustomization';
import {
  getStorageModePreference,
  getWithRevision,
  setStorageModePreference,
  type StorageKey
} from '../index';
import {
  deactivateActiveGenerationForRollback,
  getActiveGeneration,
  getGenerationRecordRevisions,
  listGenerationSnapshots,
  listPendingMigrationJournals,
  type GenerationSnapshot
} from './generation';
import { canonicalJson, sha256Canonical } from './verification';

export interface MigrationRollbackAssessment {
  eligible: boolean;
  reason: string | null;
  storageMode: string;
  activeGeneration: string;
  snapshot: GenerationSnapshot | null;
  keyCount: number;
  defaultedKeyCount: number;
}

export type RollbackProgressStage =
  | 'preflight'
  | 'staging'
  | 'verifying-staging'
  | 'writing-legacy'
  | 'verifying-legacy'
  | 'switching-mode'
  | 'complete';

export interface RollbackProgress {
  stage: RollbackProgressStage;
  completedKeys: number;
  totalKeys: number;
  message: string;
}

export interface MigrationRollbackResult {
  snapshot: GenerationSnapshot;
  rollbackGeneration: string;
  writtenKeyCount: number;
  defaultedKeyCount: number;
  legacyFingerprint: string;
}

export interface LegacyStorageRollbackAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ReverseEntry {
  legacyKey: string;
  targetKey: StorageKey;
  value: unknown;
  serialized: string;
  revision: number | null;
  usedDefault: boolean;
}

const operationalDefaultsByTarget = new Map<StorageKey, unknown>(
  OPERATIONAL_LEGACY_KEY_MAP.map((entry) => [
    entry.targetKey,
    OPERATIONAL_DEFAULTS[entry.legacyKey]
  ])
);

const ROLLBACK_DEFAULTS = new Map<StorageKey, unknown>([
  ...operationalDefaultsByTarget.entries(),
  [AUTH_LEGACY_KEY_MAP.accounts.targetKey, []],
  [AUDIT_LEGACY_KEY_MAP.active.targetKey, []],
  [AUDIT_LEGACY_KEY_MAP.archives.targetKey, []],
  [CUSTOMIZATION_LEGACY_KEY_MAP.config.targetKey, DEFAULT_CUSTOMIZATION],
  [CUSTOMIZATION_LEGACY_KEY_MAP.audit.targetKey, []]
]);

const STAGING_PREFIX = 'shuttle.storage.rollback.staging.';

function stagingKey(migrationId: string, legacyKey: string): string {
  return STAGING_PREFIX + encodeURIComponent(migrationId) + '.' + encodeURIComponent(legacyKey);
}

function sameRevisionMap(expected: Record<string, number>, actual: Record<string, number>): boolean {
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(actual).sort();
  return expectedKeys.length === actualKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index] && expected[key] === actual[key]);
}

function serializeVerified(value: unknown, key: StorageKey): string {
  let serialized: string | undefined;
  try { serialized = JSON.stringify(value); }
  catch { throw new Error('IndexedDB value for ' + key + ' cannot be serialized as valid JSON.'); }
  if (typeof serialized !== 'string') throw new Error('IndexedDB value for ' + key + ' has no JSON representation.');
  let parsed: unknown;
  try { parsed = JSON.parse(serialized) as unknown; }
  catch { throw new Error('IndexedDB value for ' + key + ' produced corrupted JSON.'); }
  if (canonicalJson(parsed) !== canonicalJson(value)) {
    throw new Error('IndexedDB JSON round-trip verification failed for ' + key + '.');
  }
  return serialized;
}

function readExistingLegacyJson(storage: LegacyStorageRollbackAdapter): void {
  const marker = readAuditArchivePendingMarker(storage);
  if (marker !== null) {
    throw new Error('An unresolved audit-archive-pending marker exists. Resolve it before reversing storage migration.');
  }
  for (const definition of listImportableLegacyKeys()) {
    const raw = storage.getItem(definition.legacyKey);
    if (raw === null) continue;
    try { JSON.parse(raw) as unknown; }
    catch { throw new Error('Existing legacy data contains corrupted JSON for ' + definition.targetKey + '. Reverse migration is blocked.'); }
  }
}

async function captureReverseEntries(
  activeGeneration: string,
  storage: LegacyStorageRollbackAdapter
): Promise<{ entries: ReverseEntry[]; revisions: Record<string, number>; defaultedKeyCount: number }> {
  const before = await getGenerationRecordRevisions(activeGeneration);
  const entries: ReverseEntry[] = [];
  let defaultedKeyCount = 0;
  for (const definition of listImportableLegacyKeys()) {
    if (!definition.targetKey) continue;
    const key = definition.targetKey;
    const row = await getWithRevision(key);
    let value: unknown;
    let revision: number | null = null;
    let usedDefault = false;
    if (row) {
      value = row.value;
      revision = row.revision;
    } else {
      if (!ROLLBACK_DEFAULTS.has(key)) {
        throw new Error('IndexedDB key ' + key + ' is missing and no approved reverse-migration default exists.');
      }
      value = ROLLBACK_DEFAULTS.get(key);
      usedDefault = true;
      defaultedKeyCount += 1;
    }
    const existingRaw = storage.getItem(definition.legacyKey);
    if (existingRaw !== null) {
      try { JSON.parse(existingRaw) as unknown; }
      catch { throw new Error('Existing legacy data contains corrupted JSON for ' + key + '. Reverse migration is blocked.'); }
    }
    entries.push({
      legacyKey: definition.legacyKey,
      targetKey: key,
      value,
      serialized: serializeVerified(value, key),
      revision,
      usedDefault
    });
  }
  if (entries.length !== listImportableLegacyKeys().length) {
    throw new Error('The reverse-migration allow-list is incomplete; expected all 17 approved keys.');
  }
  const after = await getGenerationRecordRevisions(activeGeneration);
  if (!sameRevisionMap(before, after)) {
    throw new Error('IndexedDB changed while the reverse-migration pre-flight snapshot was being read. Retry after writes are quiescent.');
  }
  return { entries, revisions: after, defaultedKeyCount };
}

function emitProgress(
  onProgress: ((progress: RollbackProgress) => void) | undefined,
  stage: RollbackProgressStage,
  completedKeys: number,
  totalKeys: number,
  message: string
): void {
  onProgress?.({ stage, completedKeys, totalKeys, message });
}

export async function assessMigrationRollback(
  legacyStorage: LegacyStorageRollbackAdapter = globalThis.localStorage
): Promise<MigrationRollbackAssessment> {
  const storageMode = getStorageModePreference();
  const activeGeneration = await getActiveGeneration();
  const blocked = (
    reason: string,
    snapshot: GenerationSnapshot | null = null,
    keyCount = 0,
    defaultedKeyCount = 0
  ): MigrationRollbackAssessment => ({
    eligible: false, reason, storageMode, activeGeneration, snapshot, keyCount, defaultedKeyCount
  });
  if (!legacyStorage || typeof legacyStorage.getItem !== 'function' || typeof legacyStorage.setItem !== 'function') {
    return blocked('The browser localStorage adapter is unavailable for reverse migration.');
  }
  if (storageMode !== 'indexeddb') {
    return blocked('Reverse migration is available only while IndexedDB is the selected storage backend.');
  }
  const pending = await listPendingMigrationJournals();
  if (pending.length > 0) {
    return blocked('An incomplete storage migration journal exists. Resolve or recover it before starting reverse migration.');
  }
  const snapshot = (await listGenerationSnapshots()).find((item) =>
    item.nextGeneration === activeGeneration && !item.rolledBackAt
  ) ?? null;
  if (!snapshot || !snapshot.recordRevisions) {
    return blocked('No complete migration snapshot matches the active IndexedDB generation.', snapshot);
  }
  try {
    readExistingLegacyJson(legacyStorage);
    const captured = await captureReverseEntries(activeGeneration, legacyStorage);
    return {
      eligible: true, reason: null, storageMode, activeGeneration, snapshot,
      keyCount: captured.entries.length, defaultedKeyCount: captured.defaultedKeyCount
    };
  } catch (error) {
    return blocked(error instanceof Error ? error.message : 'Reverse-migration pre-flight failed.', snapshot);
  }
}

/**
 * Reverse migration is caller-triggered only. It stages all approved values,
 * verifies the staged JSON, writes the current IndexedDB values to the legacy
 * keys, verifies every target again, and only then switches the next startup
 * to localStorage. Existing keys are never deleted.
 *
 * If interrupted or any write/verification fails, IndexedDB remains selected.
 * Deterministic staging keys are retained so a retry can safely overwrite and
 * re-verify them. The active IndexedDB generation is retained for recovery.
 */
let reverseMigrationSingleFlight: Promise<MigrationRollbackResult> | null = null;

async function runReverseMigration(
  legacyStorage: LegacyStorageRollbackAdapter = globalThis.localStorage,
  onProgress?: (progress: RollbackProgress) => void
): Promise<MigrationRollbackResult> {
  const assessment = await assessMigrationRollback(legacyStorage);
  if (!assessment.eligible || !assessment.snapshot) {
    throw new Error(assessment.reason || 'The migration is not eligible for reverse migration.');
  }
  emitProgress(onProgress, 'preflight', 0, assessment.keyCount, 'Reverse-migration pre-flight passed.');
  const captured = await captureReverseEntries(assessment.activeGeneration, legacyStorage);
  const total = captured.entries.length;
  const stagedValues: Array<{ entry: ReverseEntry; stagingKey: string }> = [];

  emitProgress(onProgress, 'staging', 0, total, 'Staging current IndexedDB values without changing legacy keys.');
  for (let index = 0; index < captured.entries.length; index += 1) {
    const entry = captured.entries[index];
    const key = stagingKey(assessment.snapshot.migrationId, entry.legacyKey);
    legacyStorage.setItem(key, entry.serialized);
    stagedValues.push({ entry, stagingKey: key });
    emitProgress(onProgress, 'staging', index + 1, total, 'Staged ' + (index + 1) + ' of ' + total + ' approved keys.');
  }

  emitProgress(onProgress, 'verifying-staging', 0, total, 'Verifying every staged JSON value.');
  const stagedPayload: Array<{ key: string; value: unknown }> = [];
  for (let index = 0; index < stagedValues.length; index += 1) {
    const { entry, stagingKey: key } = stagedValues[index];
    const raw = legacyStorage.getItem(key);
    if (raw === null) throw new Error('A staged reverse-migration value is missing for ' + entry.targetKey + '.');
    let parsed: unknown;
    try { parsed = JSON.parse(raw) as unknown; }
    catch { throw new Error('Staged reverse-migration JSON is corrupted for ' + entry.targetKey + '.'); }
    if (canonicalJson(parsed) !== canonicalJson(entry.value)) {
      throw new Error('Staged reverse-migration verification failed for ' + entry.targetKey + '.');
    }
    stagedPayload.push({ key: entry.legacyKey, value: parsed });
    emitProgress(onProgress, 'verifying-staging', index + 1, total, 'Verified staged key ' + (index + 1) + ' of ' + total + '.');
  }
  const legacyFingerprint = await sha256Canonical(stagedPayload);

  const revisionsBeforeWrite = await getGenerationRecordRevisions(assessment.activeGeneration);
  if (!sameRevisionMap(captured.revisions, revisionsBeforeWrite)) {
    throw new Error('IndexedDB changed while reverse-migration values were staged. No legacy keys were overwritten; retry the operation.');
  }

  emitProgress(onProgress, 'writing-legacy', 0, total, 'Writing verified IndexedDB values to the approved legacy keys.');
  for (let index = 0; index < stagedValues.length; index += 1) {
    const { entry, stagingKey: key } = stagedValues[index];
    const raw = legacyStorage.getItem(key);
    if (raw === null) throw new Error('The staged value disappeared before it could be written for ' + entry.targetKey + '.');
    legacyStorage.setItem(entry.legacyKey, raw);
    if (legacyStorage.getItem(entry.legacyKey) !== raw) {
      throw new Error('Legacy storage write verification failed for ' + entry.targetKey + '. IndexedDB remains active; retry is safe.');
    }
    emitProgress(onProgress, 'writing-legacy', index + 1, total, 'Wrote ' + (index + 1) + ' of ' + total + ' legacy keys.');
  }

  emitProgress(onProgress, 'verifying-legacy', 0, total, 'Verifying the complete reverse-migrated legacy dataset.');
  for (let index = 0; index < stagedValues.length; index += 1) {
    const { entry } = stagedValues[index];
    const raw = legacyStorage.getItem(entry.legacyKey);
    if (raw === null) throw new Error('A reverse-migrated legacy key is missing: ' + entry.targetKey + '.');
    let parsed: unknown;
    try { parsed = JSON.parse(raw) as unknown; }
    catch { throw new Error('Reverse-migrated legacy JSON is corrupted for ' + entry.targetKey + '.'); }
    if (canonicalJson(parsed) !== canonicalJson(entry.value)) {
      throw new Error('Reverse-migrated legacy value verification failed for ' + entry.targetKey + '.');
    }
    emitProgress(onProgress, 'verifying-legacy', index + 1, total, 'Verified ' + (index + 1) + ' of ' + total + ' legacy keys.');
  }

  const currentRevisions = await getGenerationRecordRevisions(assessment.activeGeneration);
  if (!sameRevisionMap(captured.revisions, currentRevisions)) {
    throw new Error('IndexedDB changed during reverse migration. The legacy copy is complete but not activated; retry to capture the latest values.');
  }

  const previousPreference = getStorageModePreference();
  emitProgress(onProgress, 'switching-mode', total, total, 'All 17 legacy keys verified. Switching the next startup to localStorage.');
  setStorageModePreference('legacy');
  let deactivation: Awaited<ReturnType<typeof deactivateActiveGenerationForRollback>>;
  try {
    deactivation = await deactivateActiveGenerationForRollback(
      assessment.snapshot.id,
      assessment.activeGeneration,
      captured.revisions,
      new Date()
    );
  } catch (error) {
    try { setStorageModePreference(previousPreference === 'legacy' ? 'indexeddb' : previousPreference); }
    catch { /* Preserve the original transaction failure. */ }
    throw error;
  }

  emitProgress(onProgress, 'complete', total, total, 'Reverse migration and mode switch completed. Reload the application.');
  return {
    ...deactivation,
    writtenKeyCount: total,
    defaultedKeyCount: captured.defaultedKeyCount,
    legacyFingerprint
  };
}


/** Share a single reverse-migration operation across StrictMode and duplicate UI events in this tab. */
export function rollbackToLegacyStorage(
  legacyStorage: LegacyStorageRollbackAdapter = globalThis.localStorage,
  onProgress?: (progress: RollbackProgress) => void
): Promise<MigrationRollbackResult> {
  if (reverseMigrationSingleFlight) return reverseMigrationSingleFlight;
  reverseMigrationSingleFlight = runReverseMigration(legacyStorage, onProgress).finally(() => {
    reverseMigrationSingleFlight = null;
  });
  return reverseMigrationSingleFlight;
}
