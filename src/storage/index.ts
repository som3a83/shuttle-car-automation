import type {
  Language, Theme, Shuttle, Battery, Fault, MaintenanceJob,
  CommunicationEndpoint, NotificationItem, AppSettings, DailyReportSnapshot, ShiftRecord,
} from '../types';
import { resolveLegacyKey } from './adapters/legacyKeyResolver';
import type { LocalAccount } from '../security/localAuth';
import type { AuditRecord as ChainedAuditRecord, AuditArchiveEntry as ChainedAuditArchiveEntry } from '../security/auditLog';
import type { CustomizationConfig as AppCustomizationConfig, AuditEntry as CustomizationAuditEntry } from '../data/applicationCustomization';

/** Storage schema aliases reuse the application's canonical domain records. */
export type LocalAccountRecord = LocalAccount;
export type AuditRecord = ChainedAuditRecord;
export type AuditArchiveEntry = ChainedAuditArchiveEntry;
export type CustomizationConfig = AppCustomizationConfig;
export type { CustomizationAuditEntry };

export interface StorageSchema {
  'operational.language': Language;
  'operational.theme': Theme;
  'operational.sidebarCollapsed': boolean;
  'operational.shuttles': Shuttle[];
  'operational.batteries': Battery[];
  'operational.faults': Fault[];
  'operational.maintenance': MaintenanceJob[];
  'operational.connections': CommunicationEndpoint[];
  'operational.notifications': NotificationItem[];
  'operational.settings': AppSettings;
  'operational.dailyReports': DailyReportSnapshot[];
  'operational.shifts': ShiftRecord[];
  'auth.accounts': LocalAccountRecord[];
  'audit.active': AuditRecord[];
  'audit.archives': AuditArchiveEntry[];
  'customization.config': CustomizationConfig;
  'customization.audit': CustomizationAuditEntry[];
}
export type StorageKey = keyof StorageSchema;
export type StorageMode = 'indexeddb' | 'legacy-fallback' | 'readonly-recovery';
export type StorageModePreference = 'legacy' | 'indexeddb' | 'auto';
export const STORAGE_MODE_KEY = 'shuttle-car-automation:storage-mode-preference';

let cachedStorageModePreference: StorageModePreference | null = null;

/** Read the requested backend once per application session. Invalid or unavailable preferences default safely to legacy. */
export function getStorageModePreference(): StorageModePreference {
  if (cachedStorageModePreference !== null) return cachedStorageModePreference;
  try {
    const raw = localStorage.getItem(STORAGE_MODE_KEY);
    cachedStorageModePreference = raw === 'legacy' || raw === 'indexeddb' || raw === 'auto' ? raw : 'legacy';
  } catch {
    cachedStorageModePreference = 'legacy';
  }
  return cachedStorageModePreference;
}

/** Persist a preference for the next startup; the active engine never changes mid-session. */
export function setStorageModePreference(mode: StorageModePreference): void {
  if (mode !== 'legacy' && mode !== 'indexeddb' && mode !== 'auto') {
    throw new TypeError('Unsupported storage mode preference.');
  }
  try {
    if (typeof localStorage === 'undefined') throw new Error('Local storage is unavailable.');
    localStorage.setItem(STORAGE_MODE_KEY, mode);
    if (cachedStorageModePreference === null) cachedStorageModePreference = mode;
  } catch (reason) {
    throw new StorageError({
      code: 'STORAGE_UNAVAILABLE',
      message: reason instanceof Error ? reason.message : 'The storage mode preference could not be saved.'
    });
  }
}
export type StorageErrorCode =
  | 'STORAGE_UNAVAILABLE' | 'STORAGE_QUOTA_EXCEEDED' | 'STORAGE_CORRUPT'
  | 'STORAGE_SCHEMA_UNSUPPORTED' | 'STORAGE_CONFLICT'
  | 'STORAGE_ATOMICITY_UNAVAILABLE' | 'STORAGE_RECOVERY_REQUIRED'
  | 'MIGRATION_INTERRUPTED' | 'MIGRATION_RECOVERY_REQUIRED'
  | 'BACKUP_INVALID' | 'AUDIT_INTEGRITY_FAILED' | 'STORAGE_TRANSACTION_FAILED';

export interface StorageErrorMetadata { [key: string]: string | number | boolean | null | undefined }
export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly key?: StorageKey;
  readonly expectedRevision?: number;
  readonly actualRevision?: number;
  readonly metadata?: StorageErrorMetadata;
  constructor(args: {
    code: StorageErrorCode; message: string; key?: StorageKey;
    expectedRevision?: number; actualRevision?: number; metadata?: StorageErrorMetadata;
  }) {
    super(args.message);
    this.name = 'StorageError';
    this.code = args.code;
    this.key = args.key;
    this.expectedRevision = args.expectedRevision;
    this.actualRevision = args.actualRevision;
    this.metadata = args.metadata;
  }
}
export interface BackupEnvelope {
  format: 'shuttle-storage-backup';
  schemaVersion: 1;
  createdAt: string;
  records: Partial<{ [K in StorageKey]: { value: StorageSchema[K]; revision: number } }>;
  checksum: string;
}
export interface RevisionedValue<T> { value: T; revision: number }
export interface SetResult { revision: number }
export interface MigrationStorageContext {
  readonly migrationId: string;
  readonly stagingGeneration: string;
  get<T = unknown>(key: StorageKey): Promise<T | null>;
  getWithRevision<T = unknown>(key: StorageKey): Promise<RevisionedValue<T> | null>;
  set<K extends StorageKey>(key: K, value: StorageSchema[K], expectedRevision?: number): Promise<SetResult>;
}

/**
 * Engine seam: production selects IndexedDB or localStorage. Tests inject an in-memory
 * engine with a chosen mode, allowing deterministic fallback/recovery tests without fake-indexeddb.
 */
export interface StorageEngine {
  getMode(): Promise<StorageMode>;
  read(key: StorageKey): Promise<RevisionedValue<unknown> | null>;
  write(key: StorageKey, value: unknown, expectedRevision?: number): Promise<number>;
  remove(key: StorageKey): Promise<void>;
  backup(): Promise<BackupEnvelope>;
  restore(backup: BackupEnvelope): Promise<void>;
}
let injectedEngine: StorageEngine | null = null;
export function __setBackendForTesting(engine: StorageEngine | null): void { injectedEngine = engine; }

const DB_NAME = 'shuttle-car-storage';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_METADATA = 'metadata';
const STORE_SNAPSHOTS = 'snapshots';
const STORE_QUARANTINE = 'quarantine';
const ACTIVE_GENERATION_KEY = 'activeGeneration';
const STORAGE_DEACTIVATED_KEY = 'storageDeactivated';
const LEGACY_PREFIX = '';
const LEGACY_REVISION_PREFIX = 'shuttle.storage.revision.';

function fail(code: StorageErrorCode, message: string, extra: Partial<ConstructorParameters<typeof StorageError>[0]> = {}): never {
  throw new StorageError({ code, message, ...extra });
}
function isQuotaError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
}
function checksumOf(value: string): string {
  // Checksums detect accidental corruption only; they are not cryptographic and do not prove authenticity.
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function stableJson(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== 'string') fail('STORAGE_CORRUPT', 'Stored data could not be serialized.');
    return serialized;
  } catch (error) {
    if (error instanceof StorageError) throw error;
    fail('STORAGE_CORRUPT', 'Stored data could not be serialized.');
  }
}
function validateStoredShape(key: StorageKey, value: unknown): boolean {
  const arrayKeys: StorageKey[] = [
    'operational.shuttles', 'operational.batteries', 'operational.faults',
    'operational.maintenance', 'operational.connections', 'operational.notifications',
    'operational.dailyReports', 'operational.shifts', 'auth.accounts',
    'audit.active', 'audit.archives', 'customization.audit',
  ];
  if (arrayKeys.includes(key)) return Array.isArray(value);
  if (key === 'operational.language' || key === 'operational.theme') return typeof value === 'string';
  if (key === 'operational.sidebarCollapsed') return typeof value === 'boolean';
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function validateBackup(input: unknown): asserts input is BackupEnvelope {
  if (!input || typeof input !== 'object') fail('BACKUP_INVALID', 'Backup structure is invalid.');
  const candidate = input as BackupEnvelope;
  if (candidate.format !== 'shuttle-storage-backup' || candidate.schemaVersion !== 1 ||
      !candidate.records || typeof candidate.records !== 'object' || typeof candidate.checksum !== 'string') {
    fail('BACKUP_INVALID', 'Backup structure or schema is invalid.');
  }
  const body = stableJson({ format: candidate.format, schemaVersion: candidate.schemaVersion,
    createdAt: candidate.createdAt, records: candidate.records });
  if (checksumOf(body) !== candidate.checksum) fail('BACKUP_INVALID', 'Backup checksum validation failed.');
}
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}
function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });
}
function indexedDbFailure(error: unknown, key?: StorageKey): never {
  if (error instanceof StorageError) throw error;
  if (isQuotaError(error)) fail('STORAGE_QUOTA_EXCEEDED', 'Storage quota was exceeded.', { key });
  fail('STORAGE_TRANSACTION_FAILED', 'The IndexedDB operation could not be completed.', { key });
}

/** Persist a corrupt raw record and its diagnostic reason without exposing it in logs. */
export async function quarantineRecord(key: StorageKey, rawValue: unknown, reason: string): Promise<void> {
  const entry = {
    id: 'quarantine-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    key,
    rawValue,
    reason: reason.slice(0, 500),
    quarantinedAt: new Date().toISOString(),
  };
  try {
    if (typeof indexedDB !== 'undefined') {
      const db = await openDatabase();
      const tx = db.transaction([STORE_RECORDS, STORE_METADATA, STORE_QUARANTINE], 'readwrite');
      const metadata = await requestResult<{ key: string; value: string } | undefined>(
        tx.objectStore(STORE_METADATA).get(ACTIVE_GENERATION_KEY));
      const generation = metadata?.value ?? 'generation-1';
      tx.objectStore(STORE_QUARANTINE).put(entry);
      // Quarantine is a move: preserve the raw payload/reason, then remove the active record.
      tx.objectStore(STORE_RECORDS).delete(generation + ':' + key);
      await transactionDone(tx);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('shuttle.storage.quarantine.' + entry.id, stableJson(entry));
      const legacyKey = resolveLegacyKey(key)?.legacyKey ?? (LEGACY_PREFIX + key);
      localStorage.removeItem(legacyKey);
      localStorage.removeItem(LEGACY_REVISION_PREFIX + key);
      return;
    }
    fail('STORAGE_UNAVAILABLE', 'No quarantine-capable storage backend is available.', { key });
  } catch (error) {
    indexedDbFailure(error, key);
  }
}
async function quarantineWithoutMasking(key: StorageKey, rawValue: unknown, reason: string): Promise<boolean> {
  try { await quarantineRecord(key, rawValue, reason); return true; }
  catch { /* Preserve the original corruption error. */ return false; }
}
const openConnections = new Set<IDBDatabase>();

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_METADATA)) db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_QUARANTINE)) db.createObjectStore(STORE_QUARANTINE, { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      openConnections.add(db);
      // A version change must never leave this module holding a blocking connection.
      db.onversionchange = () => {
        db.close();
        openConnections.delete(db);
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked'));
  });
}
class IndexedDbEngine implements StorageEngine {
  private dbPromise = openDatabase();
  async getMode(): Promise<StorageMode> {
    try { await this.dbPromise; return 'indexeddb'; }
    catch (error) { indexedDbFailure(error); }
  }
  private async activeGeneration(tx: IDBTransaction): Promise<string> {
    const row = await requestResult<{ key: string; value: string } | undefined>(
      tx.objectStore(STORE_METADATA).get(ACTIVE_GENERATION_KEY));
    return row?.value ?? 'generation-1';
  }
  /** Prevent an already-open tab from writing to IndexedDB after an admin rollback. */
  private async assertStorageActive(tx: IDBTransaction): Promise<void> {
    const row = await requestResult<{ key: string; value: boolean } | undefined>(
      tx.objectStore(STORE_METADATA).get(STORAGE_DEACTIVATED_KEY));
    if (row?.value === true) {
      tx.abort();
      fail('STORAGE_CONFLICT', 'IndexedDB was rolled back to the preserved local storage backend. Reload the application before continuing.');
    }
  }
  async read(key: StorageKey): Promise<RevisionedValue<unknown> | null> {
    try {
      const db = await this.dbPromise;
      const tx = db.transaction([STORE_RECORDS, STORE_METADATA], 'readonly');
      const generation = await this.activeGeneration(tx);
      const row = await requestResult<{ id: string; value: unknown; revision: number } | undefined>(
        tx.objectStore(STORE_RECORDS).get(generation + ':' + key));
      await transactionDone(tx);
      if (!row) return null;
      if (!validateStoredShape(key, row.value) || !Number.isSafeInteger(row.revision) || row.revision < 0) {
        await quarantineWithoutMasking(key, row.value, 'IndexedDB record failed stored-shape or revision validation.');
        fail('STORAGE_CORRUPT', 'Stored data failed integrity validation.', { key });
      }
      return { value: row.value, revision: row.revision };
    } catch (error) { indexedDbFailure(error, key); }
  }
  async write(key: StorageKey, value: unknown, expectedRevision?: number): Promise<number> {
    let tx: IDBTransaction | undefined;
    try {
      const db = await this.dbPromise;
      tx = db.transaction([STORE_RECORDS, STORE_METADATA], 'readwrite');
      await this.assertStorageActive(tx);
      const generation = await this.activeGeneration(tx);
      const store = tx.objectStore(STORE_RECORDS);
      const id = generation + ':' + key;
      const previous = await requestResult<{ id: string; value: unknown; revision: number } | undefined>(store.get(id));
      const actual = previous?.revision ?? 0;
      if (expectedRevision !== undefined && actual !== expectedRevision) {
        tx.abort();
        fail('STORAGE_CONFLICT', 'Stored data changed before this update could be committed.',
          { key, expectedRevision, actualRevision: actual });
      }
      const revision = actual + 1;
      store.put({ id, value, revision });
      await transactionDone(tx);
      return revision;
    } catch (error) {
      if (tx) { try { tx.abort(); } catch { /* transaction may already be closed */ } }
      indexedDbFailure(error, key);
    }
  }
  async remove(key: StorageKey): Promise<void> {
    try {
      const db = await this.dbPromise;
      const tx = db.transaction([STORE_RECORDS, STORE_METADATA], 'readwrite');
      await this.assertStorageActive(tx);
      const generation = await this.activeGeneration(tx);
      tx.objectStore(STORE_RECORDS).delete(generation + ':' + key);
      await transactionDone(tx);
    } catch (error) { indexedDbFailure(error, key); }
  }
  async backup(): Promise<BackupEnvelope> {
    try {
      const db = await this.dbPromise;
      const tx = db.transaction([STORE_RECORDS, STORE_METADATA], 'readonly');
      const generation = await this.activeGeneration(tx);
      const all = await requestResult<Array<{ id: string; value: unknown; revision: number }>>(tx.objectStore(STORE_RECORDS).getAll());
      await transactionDone(tx);
      const records: BackupEnvelope['records'] = {};
      for (const row of all) {
        if (!row.id.startsWith(generation + ':')) continue;
        const key = row.id.slice(generation.length + 1) as StorageKey;
        (records as Record<string, unknown>)[key] = { value: row.value, revision: row.revision };
      }
      const createdAt = new Date().toISOString();
      const body = { format: 'shuttle-storage-backup' as const, schemaVersion: 1 as const, createdAt, records };
      return { ...body, checksum: checksumOf(stableJson(body)) };
    } catch (error) { indexedDbFailure(error); }
  }
  async restore(backup: BackupEnvelope): Promise<void> {
    validateBackup(backup);
    let tx: IDBTransaction | undefined;
    try {
      const db = await this.dbPromise;
      tx = db.transaction([STORE_RECORDS, STORE_METADATA, STORE_SNAPSHOTS], 'readwrite');
      await this.assertStorageActive(tx);
      const metadata = tx.objectStore(STORE_METADATA);
      const current = await this.activeGeneration(tx);
      const next = 'generation-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      const records = tx.objectStore(STORE_RECORDS);
      for (const [key, entry] of Object.entries(backup.records)) {
        if (!entry || typeof entry !== 'object' || !('value' in entry) || !Number.isInteger(entry.revision) || entry.revision < 0) {
          tx.abort(); fail('BACKUP_INVALID', 'Backup contains an invalid record.');
        }
        records.put({ id: next + ':' + key, value: entry.value, revision: entry.revision });
      }
      tx.objectStore(STORE_SNAPSHOTS).put({ id: 'restore-' + Date.now(), previousGeneration: current, nextGeneration: next, createdAt: new Date().toISOString() });
      metadata.put({ key: ACTIVE_GENERATION_KEY, value: next });
      await transactionDone(tx);
    } catch (error) {
      if (tx) { try { tx.abort(); } catch { /* transaction may already be closed */ } }
      if (error instanceof StorageError) throw error;
      indexedDbFailure(error);
    }
  }
}
export class LegacyFallbackEngine implements StorageEngine {
  async getMode(): Promise<StorageMode> { return 'legacy-fallback'; }
  private storage(): Storage {
    try { if (typeof localStorage === 'undefined') throw new Error(); return localStorage; }
    catch { fail('STORAGE_UNAVAILABLE', 'No usable storage backend is available.'); }
  }
  async read(key: StorageKey): Promise<RevisionedValue<unknown> | null> {
    const resolution = resolveLegacyKey(key);
    if (!resolution) return null;

    const storage = this.storage();
    const compatibilityKey = LEGACY_PREFIX + key;
    const mappedRaw = storage.getItem(resolution.legacyKey);
    // Preserve records written by the pre-adapter 2B-1 fallback engine.
    // The mapped application key is authoritative whenever it exists.
    const rawKey = mappedRaw !== null || compatibilityKey === resolution.legacyKey
      ? resolution.legacyKey
      : compatibilityKey;
    const raw = mappedRaw !== null
      ? mappedRaw
      : rawKey === resolution.legacyKey ? null : storage.getItem(rawKey);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!validateStoredShape(key, parsed)) {
        const moved = await quarantineWithoutMasking(key, raw, 'Legacy fallback record failed stored-shape validation.');
        if (moved) { storage.removeItem(rawKey); storage.removeItem(LEGACY_REVISION_PREFIX + key); }
        fail('STORAGE_CORRUPT', 'Stored data failed shape validation.', { key });
      }
      const revisionRaw = storage.getItem(LEGACY_REVISION_PREFIX + key);
      const revision = revisionRaw === null ? 0 : Number(revisionRaw);
      if (!Number.isSafeInteger(revision) || revision < 0) {
        const moved = await quarantineWithoutMasking(key, raw, 'Legacy fallback revision metadata is invalid.');
        if (moved) { storage.removeItem(rawKey); storage.removeItem(LEGACY_REVISION_PREFIX + key); }
        fail('STORAGE_CORRUPT', 'Stored revision metadata is invalid.', { key });
      }
      const value = resolution.transform ? resolution.transform(parsed) : parsed;
      return { value, revision };
    } catch (error) {
      if (error instanceof StorageError) throw error;
      const moved = await quarantineWithoutMasking(key, raw, 'Legacy fallback record could not be decoded.');
      if (moved) { storage.removeItem(rawKey); storage.removeItem(LEGACY_REVISION_PREFIX + key); }
      fail('STORAGE_CORRUPT', 'Stored data could not be decoded.', { key });
    }
  }
  async write(key: StorageKey, value: unknown, expectedRevision?: number): Promise<number> {
    const resolution = resolveLegacyKey(key);
    if (!resolution) fail('STORAGE_SCHEMA_UNSUPPORTED', 'No approved legacy key mapping exists for this storage key.', { key });

    const storage = this.storage();
    const compatibilityKey = LEGACY_PREFIX + key;
    const mappedRaw = storage.getItem(resolution.legacyKey);
    const compatibilityRaw = mappedRaw === null && compatibilityKey !== resolution.legacyKey
      ? storage.getItem(compatibilityKey)
      : null;
    // Continue updating a pre-existing 2B-1 fallback record in place. New keys
    // and records already on the mapped path use the LEGACY_KEY_MAP destination.
    const targetKey = mappedRaw === null && compatibilityRaw !== null
      ? compatibilityKey
      : resolution.legacyKey;
    const raw = mappedRaw ?? compatibilityRaw;
    const revisionRaw = storage.getItem(LEGACY_REVISION_PREFIX + key);
    // Legacy records without a revision sidecar are revision 0: expectedRevision 0 creates the sidecar.
    // The sidecar remains keyed by the unified StorageKey, exactly as in 2B-1.
    const actual = revisionRaw === null ? 0 : Number(revisionRaw);
    if (!Number.isSafeInteger(actual) || actual < 0) {
      const moved = await quarantineWithoutMasking(key, raw, 'Legacy fallback revision sidecar is invalid.');
      if (moved) {
        storage.removeItem(targetKey);
        storage.removeItem(LEGACY_REVISION_PREFIX + key);
      }
      fail('STORAGE_CORRUPT', 'Stored revision metadata is invalid.', { key });
    }
    if (expectedRevision !== undefined && actual !== expectedRevision) {
      fail('STORAGE_CONFLICT', 'Stored data changed before this update could be committed.',
        { key, expectedRevision, actualRevision: actual });
    }
    const revision = actual + 1;
    try {
      // Read transforms are intentionally not applied to writes: persist the exact caller value.
      storage.setItem(targetKey, stableJson(value));
      storage.setItem(LEGACY_REVISION_PREFIX + key, String(revision));
      return revision;
    } catch (error) {
      if (isQuotaError(error)) fail('STORAGE_QUOTA_EXCEEDED', 'Storage quota was exceeded.', { key });
      fail('STORAGE_UNAVAILABLE', 'The fallback storage write failed.', { key });
    }
  }
  async remove(key: StorageKey): Promise<void> {
    const resolution = resolveLegacyKey(key);
    if (!resolution) fail('STORAGE_SCHEMA_UNSUPPORTED', 'No approved legacy key mapping exists for this storage key.', { key });
    const storage = this.storage();
    storage.removeItem(resolution.legacyKey);
    const compatibilityKey = LEGACY_PREFIX + key;
    if (compatibilityKey !== resolution.legacyKey) storage.removeItem(compatibilityKey);
    storage.removeItem(LEGACY_REVISION_PREFIX + key);
  }
  async backup(): Promise<BackupEnvelope> { fail('STORAGE_ATOMICITY_UNAVAILABLE', 'Backup requires transaction guarantees unavailable in fallback mode.'); }
  async restore(_backup: BackupEnvelope): Promise<void> { fail('STORAGE_ATOMICITY_UNAVAILABLE', 'Restore requires transaction guarantees unavailable in fallback mode.'); }
}
class ReadonlyRecoveryEngine implements StorageEngine {
  async getMode(): Promise<StorageMode> { return 'readonly-recovery'; }
  async read(_key: StorageKey): Promise<RevisionedValue<unknown> | null> { return null; }
  async write(key: StorageKey): Promise<number> { fail('STORAGE_RECOVERY_REQUIRED', 'Storage recovery must be completed before writing.', { key }); }
  async remove(key: StorageKey): Promise<void> { fail('STORAGE_RECOVERY_REQUIRED', 'Storage recovery must be completed before removing data.', { key }); }
  async backup(): Promise<BackupEnvelope> { fail('STORAGE_RECOVERY_REQUIRED', 'Storage recovery must be completed before creating a backup.'); }
  async restore(_backup: BackupEnvelope): Promise<void> { fail('STORAGE_RECOVERY_REQUIRED', 'Storage recovery must be completed before restoring a backup.'); }
}
let productionEnginePromise: Promise<StorageEngine> | null = null;
async function engine(): Promise<StorageEngine> {
  if (injectedEngine) return injectedEngine;
  if (!productionEnginePromise) {
    productionEnginePromise = (async () => {
      const preference = getStorageModePreference();
      if (preference === 'legacy') return new LegacyFallbackEngine();
      if (preference === 'indexeddb') {
        try {
          const db = new IndexedDbEngine();
          await db.getMode();
          return db;
        } catch (reason) {
          throw new StorageError({
            code: 'STORAGE_UNAVAILABLE',
            message: reason instanceof Error
              ? `IndexedDB was explicitly requested but is unavailable: ${reason.message}`
              : 'IndexedDB was explicitly requested but is unavailable.'
          });
        }
      }
      // 'auto' preserves the original IndexedDB-first, legacy-fallback behavior.
      try {
        const db = new IndexedDbEngine();
        await db.getMode();
        return db;
      } catch {
        try {
          if (typeof localStorage !== 'undefined') {
            void localStorage.length;
            return new LegacyFallbackEngine();
          }
        } catch { /* unavailable */ }
        return new ReadonlyRecoveryEngine();
      }
    })();
  }
  return productionEnginePromise;
}
/** Returns the single active application backend selected by the persisted storage preference. */
export async function getStorageEngine(): Promise<StorageEngine> {
  return engine();
}

export function __resetStorageForTesting(): void { injectedEngine = null; productionEnginePromise = null; cachedStorageModePreference = null; }

/**
 * Test-only cleanup: close every live IndexedDB connection opened by this module.
 * The handles are tracked at open time, including the separate quarantine connection.
 */
export async function __closeForTesting(): Promise<void> {
  const pendingEngine = productionEnginePromise;
  if (pendingEngine) {
    try { await pendingEngine; } catch { /* A failed open has no live handle to close. */ }
  }
  for (const db of openConnections) {
    try { db.close(); } catch { /* Best-effort cleanup; continue closing other handles. */ }
    openConnections.delete(db);
  }
}
/** Creates an explicit writer/reader bound to an isolated staging generation. */
export function createStagingContext(generationId: string, migrationId = generationId): MigrationStorageContext {
  if (!generationId || !/^[A-Za-z0-9._-]{1,128}$/.test(generationId)) {
    throw new TypeError('A valid staging generation identifier is required.');
  }
  if (!migrationId || !/^[A-Za-z0-9._-]{1,128}$/.test(migrationId)) {
    throw new TypeError('A valid migration identifier is required.');
  }
  const recordId = (key: StorageKey) => generationId + ':' + key;
  async function readStaged<T>(key: StorageKey): Promise<RevisionedValue<T> | null> {
    if (typeof indexedDB === 'undefined') fail('STORAGE_UNAVAILABLE', 'IndexedDB is required for staging migration data.', { key });
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE_RECORDS], 'readonly');
      const row = await requestResult<{ id: string; value: unknown; revision: number } | undefined>(
        tx.objectStore(STORE_RECORDS).get(recordId(key)));
      await transactionDone(tx);
      if (!row) return null;
      if (!validateStoredShape(key, row.value) || !Number.isSafeInteger(row.revision) || row.revision < 0) {
        fail('STORAGE_CORRUPT', 'Staging record failed shape or revision validation.', { key });
      }
      return { value: row.value as T, revision: row.revision };
    } catch (error) { indexedDbFailure(error, key); }
  }
  return {
    migrationId,
    stagingGeneration: generationId,
    async get<T = unknown>(key: StorageKey): Promise<T | null> {
      const row = await readStaged<T>(key);
      return row ? row.value : null;
    },
    getWithRevision: readStaged,
    async set<K extends StorageKey>(key: K, value: StorageSchema[K], expectedRevision?: number): Promise<SetResult> {
      if (!validateStoredShape(key, value)) fail('STORAGE_CORRUPT', 'Staging value failed stored-shape validation.', { key });
      if (typeof indexedDB === 'undefined') fail('STORAGE_UNAVAILABLE', 'IndexedDB is required for staging migration data.', { key });
      let tx: IDBTransaction | undefined;
      try {
        const db = await openDatabase();
        tx = db.transaction([STORE_RECORDS], 'readwrite');
        const store = tx.objectStore(STORE_RECORDS);
        const id = recordId(key);
        const previous = await requestResult<{ id: string; value: unknown; revision: number } | undefined>(store.get(id));
        const actual = previous?.revision ?? 0;
        if (expectedRevision !== undefined && actual !== expectedRevision) {
          tx.abort();
          fail('STORAGE_CONFLICT', 'Staging data changed before this update could be committed.', { key, expectedRevision, actualRevision: actual });
        }
        const revision = actual + 1;
        store.put({ id, value, revision });
        await transactionDone(tx);
        return { revision };
      } catch (error) {
        if (tx) { try { tx.abort(); } catch { /* transaction may be closed */ } }
        indexedDbFailure(error, key);
      }
    }
  };
}

export async function getMode(): Promise<StorageMode> {
  try { return await (await engine()).getMode(); }
  catch (error) { if (error instanceof StorageError) throw error; fail('STORAGE_TRANSACTION_FAILED', 'The storage mode could not be determined.'); }
}
export async function get<T = unknown>(key: StorageKey): Promise<T | null> {
  try { const result = await (await engine()).read(key); return result ? result.value as T : null; }
  catch (error) { if (error instanceof StorageError) throw error; if (isQuotaError(error)) fail('STORAGE_QUOTA_EXCEEDED', 'Storage quota was exceeded.', { key }); fail('STORAGE_TRANSACTION_FAILED', 'The storage read could not be completed.', { key }); }
}
export async function getWithRevision<T = unknown>(key: StorageKey): Promise<RevisionedValue<T> | null> {
  try { const result = await (await engine()).read(key); return result ? { value: result.value as T, revision: result.revision } : null; }
  catch (error) { if (error instanceof StorageError) throw error; if (isQuotaError(error)) fail('STORAGE_QUOTA_EXCEEDED', 'Storage quota was exceeded.', { key }); fail('STORAGE_TRANSACTION_FAILED', 'The storage read could not be completed.', { key }); }
}
export async function set<K extends StorageKey>(key: K, value: StorageSchema[K], expectedRevision?: number): Promise<SetResult> {
  const active = await engine();
  const mode = await active.getMode();
  if (mode === 'readonly-recovery') fail('STORAGE_RECOVERY_REQUIRED', 'Storage recovery must be completed before writing.', { key });
  try { return { revision: await active.write(key, value, expectedRevision) }; }
  catch (error) {
    if (error instanceof StorageError) throw error;
    if (isQuotaError(error)) fail('STORAGE_QUOTA_EXCEEDED', 'Storage quota was exceeded.', { key });
    fail('STORAGE_TRANSACTION_FAILED', 'The storage write could not be completed.', { key });
  }
}
export async function remove(key: StorageKey): Promise<void> {
  const active = await engine();
  if (await active.getMode() === 'readonly-recovery') fail('STORAGE_RECOVERY_REQUIRED', 'Storage recovery must be completed before removing data.', { key });
  try { await active.remove(key); }
  catch (error) { if (error instanceof StorageError) throw error; if (isQuotaError(error)) fail('STORAGE_QUOTA_EXCEEDED', 'Storage quota was exceeded.', { key }); fail('STORAGE_TRANSACTION_FAILED', 'The storage removal could not be completed.', { key }); }
}
export async function backup(): Promise<BackupEnvelope> {
  const active = await engine();
  if (await active.getMode() === 'readonly-recovery') fail('STORAGE_RECOVERY_REQUIRED', 'Storage recovery must be completed before creating a backup.');
  try { return await active.backup(); }
  catch (error) { if (error instanceof StorageError) throw error; if (isQuotaError(error)) fail('STORAGE_QUOTA_EXCEEDED', 'Storage quota was exceeded.'); fail('STORAGE_TRANSACTION_FAILED', 'The storage backup could not be completed.'); }
}
export async function restore(input: BackupEnvelope): Promise<void> {
  const active = await engine();
  if (await active.getMode() === 'readonly-recovery') fail('STORAGE_RECOVERY_REQUIRED', 'Storage recovery must be completed before restoring a backup.');
  validateBackup(input);
  try { await active.restore(input); }
  catch (error) { if (error instanceof StorageError) throw error; if (isQuotaError(error)) fail('STORAGE_QUOTA_EXCEEDED', 'Storage quota was exceeded.'); fail('STORAGE_TRANSACTION_FAILED', 'The storage restore could not be completed.'); }
}
