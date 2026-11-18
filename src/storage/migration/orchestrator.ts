import {
  EXCLUDED_SESSION_STORAGE_KEY,
  LEGACY_KEY_MAP,
  listImportableLegacyKeys,
  readAuditArchivePendingMarker,
  type AdapterResult,
  type LegacyReadStorage
} from '../adapters/legacyKeyMap';
import { importOperationalData } from '../adapters/operationalAdapter';
import { importAuthData } from '../adapters/authAdapter';
import { importAuditData } from '../adapters/auditAdapter';
import { importCustomizationData } from '../adapters/customizationAdapter';
import {
  createStagingContext,
  setStorageModePreference,
  type MigrationStorageContext,
  type StorageKey
} from '../index';
import {
  acquireMigrationLock,
  createStagingGeneration,
  getActiveGeneration,
  getGenerationRecordCount,
  getMigrationJournal,
  listPendingMigrationJournals,
  releaseMigrationLock,
  renewMigrationLock,
  saveMigrationJournal,
  switchActiveGeneration,
  type JournalRecord
} from './generation';
import { canTransition, transition } from './stateMachine';
import { MigrationState, type MigrationOptions, type MigrationResult } from './types';
import { sha256Canonical, verifyStagedMigration } from './verification';

export const MIGRATION_KEY_ORDER: readonly StorageKey[] = [
  'operational.language',
  'operational.theme',
  'operational.sidebarCollapsed',
  'operational.shuttles',
  'operational.batteries',
  'operational.faults',
  'operational.maintenance',
  'operational.connections',
  'operational.notifications',
  'operational.settings',
  'operational.dailyReports',
  'operational.shifts',
  'auth.accounts',
  'audit.active',
  'audit.archives',
  'customization.config',
  'customization.audit'
];

const LOCK_LEASE_MS = 15 * 60 * 1000;
let singleFlight: Promise<MigrationResult> | null = null;

function createToken(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return prefix + '-' + (uuid ?? (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Migration failed for an unknown reason.';
}

function recordCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return value === null || value === undefined ? 0 : 1;
}

function nextState(journal: JournalRecord, next: MigrationState, now: Date): JournalRecord {
  if (journal.state === next) return { ...journal, updatedAt: now.toISOString() };
  return { ...journal, state: transition(journal.state, next), updatedAt: now.toISOString() };
}

async function persistState(
  journal: JournalRecord,
  next: MigrationState,
  now: Date
): Promise<JournalRecord> {
  const updated = nextState(journal, next, now);
  await saveMigrationJournal(updated);
  return updated;
}

async function sourceFingerprint(legacyStorage: LegacyReadStorage): Promise<string> {
  const values: Array<{ key: string; raw: string | null }> = [];
  for (const definition of listImportableLegacyKeys()) {
    const raw = legacyStorage.getItem(definition.legacyKey);
    if (raw !== null) {
      try {
        JSON.parse(raw) as unknown;
      } catch {
        throw new Error('Legacy source contains invalid JSON for ' + definition.targetKey + '.');
      }
    }
    values.push({ key: definition.legacyKey, raw });
  }
  return sha256Canonical(values);
}

function validateAllowList(): void {
  const definitions = listImportableLegacyKeys();
  if (definitions.length !== MIGRATION_KEY_ORDER.length) {
    throw new Error('The approved legacy import allow-list does not contain exactly 17 keys.');
  }
  const mapped = definitions.map((entry) => entry.targetKey);
  if (mapped.some((key, index) => key !== MIGRATION_KEY_ORDER[index])) {
    throw new Error('The approved legacy import order differs from the migration design.');
  }
  if (LEGACY_KEY_MAP.some((entry) => entry.legacyKey === EXCLUDED_SESSION_STORAGE_KEY || entry.targetKey === ('session' as StorageKey))) {
    throw new Error('Session storage must remain excluded from migration.');
  }
}

function resultFrom(
  migrationId: string,
  state: MigrationState,
  completedKeyCount: number,
  error?: string
): MigrationResult {
  return {
    success: state === MigrationState.COMPLETE,
    migrationId,
    state,
    completedKeyCount,
    expectedKeyCount: MIGRATION_KEY_ORDER.length,
    verificationStatus: state === MigrationState.COMPLETE ? 'passed' : 'failed',
    ...(error ? { error } : {})
  };
}

function ensureResultsSuccessful(results: readonly AdapterResult[]): void {
  const failed = results.filter((result) =>
    result.status !== 'imported' && result.status !== 'already-synced'
  );
  if (failed.length) {
    const detail = failed.map((result) => `${result.key}: ${result.status}${'message' in result ? ' — ' + result.message : ''}`).join('; ');
    throw new Error('Legacy validation/import was blocked: ' + detail);
  }
}

async function loadOrCreateJournal(
  migrationId: string,
  fingerprint: string,
  now: Date
): Promise<JournalRecord> {
  const existing = await getMigrationJournal(migrationId);
  if (existing) {
    if (existing.sourceFingerprint !== fingerprint) {
      throw new Error('Legacy source changed since this migration journal was created; recovery review is required.');
    }
    if (existing.state === MigrationState.COMPLETE) return existing;
    if (existing.state === MigrationState.FAILED) {
      throw new Error('This migration is marked FAILED. Start a new migration ID after reviewing the staging data.');
    }
    if (existing.state === MigrationState.RECOVERY_REQUIRED) {
      throw new Error('This migration is marked RECOVERY_REQUIRED and cannot be resumed automatically.');
    }
    return existing;
  }
  const previousGeneration = await getActiveGeneration();
  const idPart = migrationId.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80);
  return {
    migrationId,
    state: MigrationState.IDLE,
    sourceFingerprint: fingerprint,
    expectedKeyCount: MIGRATION_KEY_ORDER.length,
    completedKeyCount: 0,
    verificationStatus: 'pending',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    stagingGeneration: 'generation-migration-' + idPart,
    previousGeneration,
    ownerToken: ''
  };
}

async function updateProgress(
  journal: JournalRecord,
  completedKeyCount: number,
  now: Date,
  migrationId: string,
  ownerToken: string
): Promise<JournalRecord> {
  await renewMigrationLock(migrationId, ownerToken, now.getTime() + LOCK_LEASE_MS);
  const updated = { ...journal, completedKeyCount, updatedAt: now.toISOString() };
  await saveMigrationJournal(updated);
  return updated;
}

async function runMigration(options: MigrationOptions): Promise<MigrationResult> {
  const nowProvider = options.now ?? (() => new Date());
  const now = nowProvider();
  let migrationId = options.migrationId ?? '';
  let ownerToken = options.ownerToken ?? createToken('owner');
  let journal: JournalRecord | null = null;
  let lockAcquired = false;
  let completedKeyCount = 0;

  try {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is unavailable. Migration refuses to fall back to localStorage.');
    }
    const legacyStorage = options.legacyStorage ?? globalThis.localStorage;
    if (!legacyStorage || typeof legacyStorage.getItem !== 'function') {
      throw new Error('Legacy localStorage is unavailable; migration cannot read its source.');
    }

    validateAllowList();
    const pendingMarker = readAuditArchivePendingMarker(legacyStorage);
    if (pendingMarker !== null) {
      throw new Error('The preserved audit-archive-pending marker exists. Resolve it explicitly before migration.');
    }
    const fingerprint = await sourceFingerprint(legacyStorage);

    const pending = await listPendingMigrationJournals();
    if (!migrationId) {
      if (pending.length > 1) {
        throw new Error('More than one unfinished migration journal exists; select the migration ID for recovery.');
      }
      migrationId = pending[0]?.migrationId ?? createToken('migration');
    }
    const conflictingPending = pending.find((entry) => entry.migrationId !== migrationId);
    if (conflictingPending) {
      throw new Error('Another unfinished migration exists: ' + conflictingPending.migrationId + '. Complete or recover it first.');
    }

    journal = await loadOrCreateJournal(migrationId, fingerprint, now);
    if (journal.state === MigrationState.COMPLETE) {
      return resultFrom(migrationId, journal.state, journal.completedKeyCount);
    }

    await acquireMigrationLock(
      migrationId,
      ownerToken,
      options.lockExpiresAt ?? now.getTime() + LOCK_LEASE_MS,
      now.getTime()
    );
    lockAcquired = true;
    journal = { ...journal, ownerToken };
    if (journal.state === MigrationState.IDLE) {
      journal = nextState(journal, MigrationState.PREFLIGHT, nowProvider());
      await saveMigrationJournal(journal);
    }

    const activeGeneration = await getActiveGeneration();
    // The pointer and committed journal are switched in one transaction. If a
    // caller resumes after the transaction, finish only the preference step.
    if (activeGeneration === journal.stagingGeneration) {
      if (journal.state === MigrationState.COMMITTING) {
        journal = nextState(journal, MigrationState.COMMITTED_PENDING_MODE_SWITCH, nowProvider());
        await saveMigrationJournal(journal);
      }
      if (journal.state !== MigrationState.COMMITTED_PENDING_MODE_SWITCH) {
        throw new Error('The staging generation is active but the migration journal is not in a resumable commit state.');
      }
      setStorageModePreference('indexeddb');
      journal = nextState(journal, MigrationState.COMPLETE, nowProvider());
      await saveMigrationJournal(journal);
      return resultFrom(migrationId, journal.state, journal.completedKeyCount);
    }

    const previousGeneration = journal.previousGeneration ?? activeGeneration;
    if (previousGeneration !== activeGeneration) {
      throw new Error('The active generation no longer matches the migration pre-flight snapshot.');
    }
    if (journal.state === MigrationState.COMMITTED_PENDING_MODE_SWITCH) {
      throw new Error('The journal indicates a committed pointer switch, but the active generation does not match.');
    }
    if (await getGenerationRecordCount(activeGeneration) !== 0) {
      throw new Error('The IndexedDB destination is not empty; migration was blocked without changing the active generation.');
    }

    if (journal.state === MigrationState.PREFLIGHT) {
      journal = await persistState(journal, MigrationState.LOCKED, nowProvider());
    }
    await createStagingGeneration(journal.stagingGeneration, migrationId, nowProvider().toISOString());

    if (journal.state === MigrationState.LOCKED) {
      journal = await persistState(journal, MigrationState.STAGING, nowProvider());
    }
    const context: MigrationStorageContext = createStagingContext(journal.stagingGeneration, migrationId);
    const results: AdapterResult[] = [];

    const operational = await importOperationalData(legacyStorage, context);
    results.push(...operational);
    ensureResultsSuccessful(operational);
    journal = await updateProgress(journal, results.length, nowProvider(), migrationId, ownerToken);

    const auth = await importAuthData(legacyStorage, context);
    results.push(auth);
    ensureResultsSuccessful([auth]);
    journal = await updateProgress(journal, results.length, nowProvider(), migrationId, ownerToken);

    const audit = await importAuditData(legacyStorage, context);
    results.push(...audit);
    ensureResultsSuccessful(audit);
    journal = await updateProgress(journal, results.length, nowProvider(), migrationId, ownerToken);

    const customization = await importCustomizationData(legacyStorage, context);
    results.push(...customization);
    ensureResultsSuccessful(customization);
    journal = await updateProgress(journal, results.length, nowProvider(), migrationId, ownerToken);
    completedKeyCount = results.length;
    const sourceByKey: Record<string, 'legacy' | 'default'> = {};
    for (const definition of listImportableLegacyKeys()) {
      if (definition.targetKey) {
        sourceByKey[definition.targetKey] =
          legacyStorage.getItem(definition.legacyKey) === null ? 'default' : 'legacy';
      }
    }
    journal = { ...journal, sourceByKey, updatedAt: nowProvider().toISOString() };
    await saveMigrationJournal(journal);

    if (results.length !== MIGRATION_KEY_ORDER.length ||
        results.some((result, index) => result.key !== MIGRATION_KEY_ORDER[index])) {
      throw new Error('The adapter output did not produce the exact 17-key migration order.');
    }

    if (journal.state === MigrationState.STAGING) {
      journal = await persistState(journal, MigrationState.VERIFYING, nowProvider());
    } else if (journal.state === MigrationState.LOCKED) {
      throw new Error('Migration journal did not enter STAGING before verification.');
    }

    const pendingMarkerBeforeCommit = readAuditArchivePendingMarker(legacyStorage);
    if (pendingMarkerBeforeCommit !== null) {
      throw new Error('The audit-archive-pending marker appeared during migration; refusing to commit.');
    }
    const finalSourceFingerprint = await sourceFingerprint(legacyStorage);
    if (finalSourceFingerprint !== journal.sourceFingerprint) {
      throw new Error('Legacy source changed during migration; refusing to activate the staging generation.');
    }

    const verification = await verifyStagedMigration(context, results, MIGRATION_KEY_ORDER);
    if (!verification.valid) {
      throw new Error('Migration verification failed: ' + verification.errors.join(' | '));
    }
    journal = {
      ...journal,
      verificationStatus: 'passed',
      completedKeyCount,
      updatedAt: nowProvider().toISOString()
    };
    await saveMigrationJournal(journal);

    if (journal.state === MigrationState.VERIFYING) {
      journal = await persistState(journal, MigrationState.READY_TO_COMMIT, nowProvider());
    }
    if (journal.state === MigrationState.READY_TO_COMMIT) {
      journal = await persistState(journal, MigrationState.COMMITTING, nowProvider());
    }
    if (journal.state !== MigrationState.COMMITTING) {
      throw new Error('Migration is not in a commit-ready state.');
    }

    await renewMigrationLock(migrationId, ownerToken, nowProvider().getTime() + LOCK_LEASE_MS);
    await switchActiveGeneration({
      migrationId,
      ownerToken,
      previousGeneration,
      nextGeneration: journal.stagingGeneration,
      expectedKeys: MIGRATION_KEY_ORDER,
      journal,
      now: nowProvider
    });
    journal = { ...journal, state: MigrationState.COMMITTED_PENDING_MODE_SWITCH, updatedAt: nowProvider().toISOString() };

    // Preference is written only after the atomic IndexedDB pointer transaction.
    // The storage module intentionally applies this preference on the next startup.
    setStorageModePreference('indexeddb');
    journal = nextState(journal, MigrationState.COMPLETE, nowProvider());
    await saveMigrationJournal(journal);
    return resultFrom(migrationId, journal.state, journal.completedKeyCount);
  } catch (error) {
    const message = errorMessage(error);
    if (lockAcquired && journal && journal.state !== MigrationState.COMPLETE &&
        journal.state !== MigrationState.FAILED && journal.state !== MigrationState.RECOVERY_REQUIRED) {
      const failureState = journal.state === MigrationState.COMMITTED_PENDING_MODE_SWITCH
        ? MigrationState.RECOVERY_REQUIRED
        : MigrationState.FAILED;
      if (canTransition(journal.state, failureState)) {
        journal = { ...journal, state: failureState, error: message, updatedAt: nowProvider().toISOString() };
        try { await saveMigrationJournal(journal); } catch { /* Preserve the original migration error. */ }
      }
    }
    return resultFrom(
      migrationId || 'not-started',
      journal?.state ?? MigrationState.FAILED,
      journal?.completedKeyCount ?? completedKeyCount,
      message
    );
  } finally {
    if (lockAcquired && migrationId) {
      try { await releaseMigrationLock(migrationId, ownerToken); } catch { /* Lock lease expires if release cannot commit. */ }
    }
  }
}

/**
 * Explicit, caller-invoked migration API. No application startup path imports or
 * invokes this function; concurrent calls in one tab share a single promise.
 */
export function migrateToIndexedDb(options: MigrationOptions = {}): Promise<MigrationResult> {
  if (singleFlight) return singleFlight;
  singleFlight = runMigration(options).finally(() => {
    singleFlight = null;
  });
  return singleFlight;
}
