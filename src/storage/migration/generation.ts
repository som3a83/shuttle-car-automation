import type { StorageKey } from '../index';
import { MigrationState, type MigrationJournal } from './types';

const DB_NAME = 'shuttle-car-storage';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_METADATA = 'metadata';
const STORE_SNAPSHOTS = 'snapshots';
export const ACTIVE_GENERATION_METADATA_KEY = 'activeGeneration';
export const MIGRATION_LOCK_METADATA_KEY = 'migrationLock';

export type JournalRecord = MigrationJournal & {
  previousGeneration?: string;
  sourceByKey?: Record<string, 'legacy' | 'default'>;
};
export interface MigrationLockRecord {
  migrationId: string;
  ownerToken: string;
  expires_at: number;
  acquiredAt: string;
}
export interface GenerationSnapshot {
  id: string;
  migrationId: string;
  previousGeneration: string;
  nextGeneration: string;
  sourceFingerprint: string;
  createdAt: string;
  keyCount: number;
}
export interface PointerSwitchOptions {
  migrationId: string;
  ownerToken: string;
  previousGeneration: string;
  nextGeneration: string;
  expectedKeys: readonly StorageKey[];
  journal: JournalRecord;
  now?: () => Date;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

export function openMigrationDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is unavailable; migration cannot use a fallback store.'));
  }
  if (!databasePromise) {
    databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_RECORDS)) db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_METADATA)) db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains('quarantine')) db.createObjectStore('quarantine', { keyPath: 'id' });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          databasePromise = null;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not open the migration database.'));
      request.onblocked = () => reject(new Error('Migration database upgrade is blocked by another connection.'));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise!;
}

export async function closeMigrationDatabaseForTesting(): Promise<void> {
  if (!databasePromise) return;
  try {
    const db = await databasePromise;
    db.close();
  } catch {
    // A failed open has no live connection to close.
  }
  databasePromise = null;
}

export async function getActiveGeneration(): Promise<string> {
  const db = await openMigrationDatabase();
  const tx = db.transaction([STORE_METADATA], 'readonly');
  const row = await requestResult<{ key: string; value: string } | undefined>(
    tx.objectStore(STORE_METADATA).get(ACTIVE_GENERATION_METADATA_KEY)
  );
  await transactionDone(tx);
  return row?.value ?? 'generation-1';
}

export async function getGenerationRecordCount(generationId: string): Promise<number> {
  const db = await openMigrationDatabase();
  const tx = db.transaction([STORE_RECORDS], 'readonly');
  const rows = await requestResult<Array<{ id: string }>>(tx.objectStore(STORE_RECORDS).getAll());
  await transactionDone(tx);
  const prefix = generationId + ':';
  return rows.filter((row) => row.id.startsWith(prefix)).length;
}

export async function isGenerationEmpty(generationId: string): Promise<boolean> {
  return (await getGenerationRecordCount(generationId)) === 0;
}

export async function getMigrationJournal(migrationId: string): Promise<JournalRecord | null> {
  const db = await openMigrationDatabase();
  const tx = db.transaction([STORE_METADATA], 'readonly');
  const row = await requestResult<{ key: string; value: JournalRecord } | undefined>(
    tx.objectStore(STORE_METADATA).get('migration:' + migrationId)
  );
  await transactionDone(tx);
  return row?.value ?? null;
}

export async function listPendingMigrationJournals(): Promise<JournalRecord[]> {
  const db = await openMigrationDatabase();
  const tx = db.transaction([STORE_METADATA], 'readonly');
  const rows = await requestResult<Array<{ key: string; value: unknown }>>(tx.objectStore(STORE_METADATA).getAll());
  await transactionDone(tx);
  return rows
    .filter((row) => row.key.startsWith('migration:') && row.value && typeof row.value === 'object')
    .map((row) => row.value as JournalRecord)
    .filter((journal) => journal.state !== MigrationState.COMPLETE && journal.state !== MigrationState.FAILED);
}

export async function saveMigrationJournal(journal: JournalRecord): Promise<void> {
  const db = await openMigrationDatabase();
  const tx = db.transaction([STORE_METADATA], 'readwrite');
  tx.objectStore(STORE_METADATA).put({ key: 'migration:' + journal.migrationId, value: journal });
  await transactionDone(tx);
}

export async function createStagingGeneration(
  generationId: string,
  migrationId: string,
  createdAt = new Date().toISOString()
): Promise<void> {
  const db = await openMigrationDatabase();
  const tx = db.transaction([STORE_METADATA], 'readwrite');
  const metadata = tx.objectStore(STORE_METADATA);
  const key = 'generation:' + generationId;
  const existing = await requestResult<{ key: string; value: { migrationId?: string; status?: string } } | undefined>(
    metadata.get(key)
  );
  if (existing && existing.value.migrationId !== migrationId) {
    tx.abort();
    throw new Error('The requested staging generation is already owned by another migration.');
  }
  if (!existing) {
    metadata.put({
      key,
      value: { generationId, migrationId, status: 'staging', createdAt }
    });
  }
  await transactionDone(tx);
}

export async function acquireMigrationLock(
  migrationId: string,
  ownerToken: string,
  expiresAt: number,
  now = Date.now()
): Promise<MigrationLockRecord> {
  const db = await openMigrationDatabase();
  const tx = db.transaction([STORE_METADATA], 'readwrite');
  const store = tx.objectStore(STORE_METADATA);
  const existing = await requestResult<{ key: string; value: MigrationLockRecord } | undefined>(
    store.get(MIGRATION_LOCK_METADATA_KEY)
  );
  const lock = existing?.value;
  if (lock && lock.expires_at > now && lock.ownerToken !== ownerToken) {
    tx.abort();
    throw new Error(`Migration is locked by another owner until ${new Date(lock.expiresAt).toISOString()}.`);
  }
  const next: MigrationLockRecord = {
    migrationId,
    ownerToken,
    expiresAt,
    acquiredAt: lock?.ownerToken === ownerToken ? lock.acquiredAt : new Date(now).toISOString()
  };
  store.put({ key: MIGRATION_LOCK_METADATA_KEY, value: next });
  await transactionDone(tx);
  return next;
}

export async function renewMigrationLock(
  migrationId: string,
  ownerToken: string,
  expiresAt: number
): Promise<void> {
  const db = await openMigrationDatabase();
  const tx = db.transaction([STORE_METADATA], 'readwrite');
  const store = tx.objectStore(STORE_METADATA);
  const row = await requestResult<{ key: string; value: MigrationLockRecord } | undefined>(
    store.get(MIGRATION_LOCK_METADATA_KEY)
  );
  if (!row || row.value.ownerToken !== ownerToken || row.value.migrationId !== migrationId) {
    tx.abort();
    throw new Error('Migration lock ownership was lost.');
  }
  store.put({ key: MIGRATION_LOCK_METADATA_KEY, value: { ...row.value, expires_at: expiresAt } });
  await transactionDone(tx);
}

export async function releaseMigrationLock(migrationId: string, ownerToken: string): Promise<void> {
  const db = await openMigrationDatabase();
  const tx = db.transaction([STORE_METADATA], 'readwrite');
  const store = tx.objectStore(STORE_METADATA);
  const row = await requestResult<{ key: string; value: MigrationLockRecord } | undefined>(
    store.get(MIGRATION_LOCK_METADATA_KEY)
  );
  if (row?.value.migrationId === migrationId && row.value.ownerToken === ownerToken) {
    store.delete(MIGRATION_LOCK_METADATA_KEY);
  }
  await transactionDone(tx);
}

/**
 * Atomically changes the visible generation and records the snapshot + journal.
 * Every staged key is checked in the same transaction as the pointer update.
 */
export async function switchActiveGeneration(options: PointerSwitchOptions): Promise<GenerationSnapshot> {
  const now = options.now ?? (() => new Date());
  const db = await openMigrationDatabase();
  const tx = db.transaction([STORE_RECORDS, STORE_METADATA, STORE_SNAPSHOTS], 'readwrite');
  const records = tx.objectStore(STORE_RECORDS);
  const metadata = tx.objectStore(STORE_METADATA);
  const snapshots = tx.objectStore(STORE_SNAPSHOTS);

  try {
    const activeRow = await requestResult<{ key: string; value: string } | undefined>(
      metadata.get(ACTIVE_GENERATION_METADATA_KEY)
    );
    const activeGeneration = activeRow?.value ?? 'generation-1';
    if (activeGeneration !== options.previousGeneration && activeGeneration !== options.nextGeneration) {
      tx.abort();
      throw new Error('Active generation changed during migration; refusing a stale pointer switch.');
    }

    const lockRow = await requestResult<{ key: string; value: MigrationLockRecord } | undefined>(
      metadata.get(MIGRATION_LOCK_METADATA_KEY)
    );
    if (!lockRow || lockRow.value.migrationId !== options.migrationId ||
        lockRow.value.ownerToken !== options.ownerToken || lockRow.value.expires_at <= now().getTime()) {
      tx.abort();
      throw new Error('Migration lock is missing, expired, or owned by another process.');
    }

    const allRecords = await requestResult<Array<{ id: string; value: unknown; revision: number }>>(records.getAll());
    const stagedIds = new Set(allRecords.filter((row) => row.id.startsWith(options.nextGeneration + ':')).map((row) => row.id));
    for (const key of options.expectedKeys) {
      if (!stagedIds.has(options.nextGeneration + ':' + key)) {
        tx.abort();
        throw new Error('Cannot activate an incomplete staging generation; missing key: ' + key);
      }
    }
    if (stagedIds.size !== options.expectedKeys.length) {
      tx.abort();
      throw new Error('Staging generation contains an unexpected number of keys.');
    }

    const createdAt = now().toISOString();
    const snapshot: GenerationSnapshot = {
      id: 'migration-snapshot:' + options.migrationId,
      migrationId: options.migrationId,
      previousGeneration: options.previousGeneration,
      nextGeneration: options.nextGeneration,
      sourceFingerprint: options.journal.sourceFingerprint,
      createdAt,
      keyCount: options.expectedKeys.length
    };
    const committedJournal: JournalRecord = {
      ...options.journal,
      state: MigrationState.COMMITTED_PENDING_MODE_SWITCH,
      updatedAt: createdAt
    };

    metadata.put({ key: ACTIVE_GENERATION_METADATA_KEY, value: options.nextGeneration });
    metadata.put({
      key: 'generation:' + options.previousGeneration,
      value: { generationId: options.previousGeneration, status: 'previous', previousAt: createdAt }
    });
    metadata.put({
      key: 'generation:' + options.nextGeneration,
      value: { generationId: options.nextGeneration, migrationId: options.migrationId, status: 'active', activatedAt: createdAt }
    });
    metadata.put({ key: 'migration:' + options.migrationId, value: committedJournal });
    snapshots.put(snapshot);
    await transactionDone(tx);
    return snapshot;
  } catch (error) {
    try { tx.abort(); } catch { /* Transaction may already be complete or aborted. */ }
    throw error;
  }
}

export async function isMigrationGenerationActive(generationId: string): Promise<boolean> {
  return (await getActiveGeneration()) === generationId;
}
