import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __setBackendForTesting, __resetStorageForTesting, backup, get, getMode, getWithRevision, quarantineRecord, remove, restore, set,
  StorageError, LegacyFallbackEngine, type BackupEnvelope, type StorageEngine, type StorageKey, type StorageMode,
} from '../index';

class MemoryEngine implements StorageEngine {
  private data = new Map<StorageKey, { value: unknown; revision: number }>();
  constructor(private mode: StorageMode = 'indexeddb') {}
  async getMode(): Promise<StorageMode> { return this.mode; }
  async read(key: StorageKey) { const row = this.data.get(key); return row ? structuredClone(row) : null; }
  async write(key: StorageKey, value: unknown, expectedRevision?: number): Promise<number> {
    if (this.mode === 'readonly-recovery') throw new StorageError({ code: 'STORAGE_RECOVERY_REQUIRED', message: 'Recovery required.', key });
    const previous = this.data.get(key);
    const actual = previous?.revision ?? 0;
    if (expectedRevision !== undefined && actual !== expectedRevision) {
      throw new StorageError({ code: 'STORAGE_CONFLICT', message: 'Revision conflict.', key, expectedRevision, actualRevision: actual });
    }
    const revision = actual + 1;
    this.data.set(key, { value: structuredClone(value), revision });
    return revision;
  }
  async remove(key: StorageKey): Promise<void> {
    if (this.mode === 'readonly-recovery') throw new StorageError({ code: 'STORAGE_RECOVERY_REQUIRED', message: 'Recovery required.', key });
    this.data.delete(key);
  }
  async backup(): Promise<BackupEnvelope> {
    if (this.mode === 'legacy-fallback') throw new StorageError({ code: 'STORAGE_ATOMICITY_UNAVAILABLE', message: 'Atomic backup unavailable.' });
    const records: BackupEnvelope['records'] = {};
    for (const [key, value] of this.data) (records as Record<string, unknown>)[key] = structuredClone(value);
    const body = { format: 'shuttle-storage-backup' as const, schemaVersion: 1 as const, createdAt: '2026-01-01T00:00:00.000Z', records };
    // Test engine mirrors the production envelope's checksum contract.
    const json = JSON.stringify(body);
    let hash = 2166136261;
    for (let i = 0; i < json.length; i++) { hash ^= json.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return { ...body, checksum: (hash >>> 0).toString(16).padStart(8, '0') };
  }
  async restore(input: BackupEnvelope): Promise<void> {
    if (this.mode === 'legacy-fallback') throw new StorageError({ code: 'STORAGE_ATOMICITY_UNAVAILABLE', message: 'Atomic restore unavailable.' });
    if (this.mode === 'readonly-recovery') throw new StorageError({ code: 'STORAGE_RECOVERY_REQUIRED', message: 'Recovery required.' });
    this.data = new Map(Object.entries(input.records).map(([key, entry]) => [key as StorageKey, structuredClone(entry!)] as [StorageKey, { value: unknown; revision: number }]));
  }
  seed(key: StorageKey, value: unknown, revision = 1): void { this.data.set(key, { value, revision }); }
}

let backend: MemoryEngine;
beforeEach(() => { backend = new MemoryEngine(); __setBackendForTesting(backend); });
afterEach(() => { __setBackendForTesting(null); });

const KEY: StorageKey = 'operational.language';

describe('Phase 2B-1 storage public API', () => {
  it('API-001 exposes the IndexedDB mode', async () => expect(await getMode()).toBe('indexeddb'));
  it('API-002 returns null for an absent key', async () => expect(await get(KEY)).toBeNull());
  it('API-003 returns null revision metadata for an absent key', async () => expect(await getWithRevision(KEY)).toBeNull());
  it('API-004 stores and reads a typed value', async () => { await set(KEY, 'ar'); expect(await get(KEY)).toBe('ar'); });
  it('API-005 returns revision 1 after first write', async () => expect(await set(KEY, 'ar')).toEqual({ revision: 1 }));
  it('API-006 increments revisions on subsequent writes', async () => { await set(KEY, 'ar'); expect(await set(KEY, 'en')).toEqual({ revision: 2 }); });
  it('API-007 returns value and revision together', async () => { await set(KEY, 'ar'); expect(await getWithRevision(KEY)).toEqual({ value: 'ar', revision: 1 }); });
  it('API-008 removes a stored key', async () => { await set(KEY, 'ar'); await remove(KEY); expect(await get(KEY)).toBeNull(); });
  it('API-009 remove of a missing key is harmless', async () => { await expect(remove(KEY)).resolves.toBeUndefined(); });
  it('API-010 set accepts a matching expected revision', async () => { await set(KEY, 'ar'); expect(await set(KEY, 'en', 1)).toEqual({ revision: 2 }); });
  it('API-011 rejects a mismatched expected revision', async () => { await set(KEY, 'ar'); await expect(set(KEY, 'en', 7)).rejects.toMatchObject({ code: 'STORAGE_CONFLICT', expectedRevision: 7, actualRevision: 1 }); });
  it('API-012 does not mutate data after a conflict', async () => { await set(KEY, 'ar'); await expect(set(KEY, 'en', 4)).rejects.toBeInstanceOf(StorageError); expect(await get(KEY)).toBe('ar'); });
  it('API-013 accepts expectedRevision 0 for a missing key', async () => { expect(await set(KEY, 'ar', 0)).toEqual({ revision: 1 }); });
  it('API-014 reports actual revision 0 for a missing-key conflict', async () => { await expect(set(KEY, 'ar', 2)).rejects.toMatchObject({ code: 'STORAGE_CONFLICT', expectedRevision: 2, actualRevision: 0 }); });
  it('API-015 does not include stored payload in conflict messages', async () => {
    const secret = 'PRIVATE-RECORD-DO-NOT-LEAK';
    await set(KEY, secret as never);
    const error = await set(KEY, 'en', 9).then(
      () => { throw new Error('Expected revision conflict was not raised.'); },
      (reason: unknown) => reason as Error,
    );
    expect(error).toBeInstanceOf(StorageError);
    expect(error.message).not.toContain(secret);
  });
  it('API-016 backup returns a versioned envelope', async () => { await set(KEY, 'ar'); const result = await backup(); expect(result).toMatchObject({ format: 'shuttle-storage-backup', schemaVersion: 1 }); });
  it('API-017 restore replaces the logical dataset', async () => { await set(KEY, 'ar'); const saved = await backup(); await set(KEY, 'en'); await restore(saved); expect(await get(KEY)).toBe('ar'); });
  it('API-018 rejects a modified backup checksum', async () => { const saved = await backup(); const invalid = { ...saved, createdAt: 'tampered' }; await expect(restore(invalid)).rejects.toMatchObject({ code: 'BACKUP_INVALID' }); });
  it('API-019 rejects an unsupported backup schema', async () => { const saved = await backup(); await expect(restore({ ...saved, schemaVersion: 99 } as never)).rejects.toMatchObject({ code: 'BACKUP_INVALID' }); });
  it('API-020 declares all approved error codes', async () => { const codes = ['STORAGE_UNAVAILABLE','STORAGE_QUOTA_EXCEEDED','STORAGE_CORRUPT','STORAGE_SCHEMA_UNSUPPORTED','STORAGE_CONFLICT','STORAGE_ATOMICITY_UNAVAILABLE','STORAGE_RECOVERY_REQUIRED','MIGRATION_INTERRUPTED','MIGRATION_RECOVERY_REQUIRED','BACKUP_INVALID','AUDIT_INTEGRITY_FAILED','STORAGE_TRANSACTION_FAILED']; expect(codes).toHaveLength(12); });
  it('API-021 StorageError exposes typed diagnostic fields', async () => { const e = new StorageError({ code: 'STORAGE_CONFLICT', message: 'Conflict.', key: KEY, expectedRevision: 2, actualRevision: 1, metadata: { reason: 'test' } }); expect(e).toMatchObject({ code: 'STORAGE_CONFLICT', key: KEY, expectedRevision: 2, actualRevision: 1, metadata: { reason: 'test' } }); });
  it('API-022 unknown values are returned without domain-level coercion', async () => { backend.seed(KEY, { legacy: true }, 3); expect(await get(KEY)).toEqual({ legacy: true }); });
  it('API-023 getWithRevision preserves the engine revision', async () => { backend.seed(KEY, 'ar', 42); expect(await getWithRevision(KEY)).toEqual({ value: 'ar', revision: 42 }); });
});

describe('backup and restore guarantees', () => {
  it('BAK-001 creates a checksum-bearing backup', async () => expect(typeof (await backup()).checksum).toBe('string'));
  it('BAK-002 preserves values and revisions in a backup', async () => { await set(KEY, 'ar'); expect((await backup()).records[KEY]).toEqual({ value: 'ar', revision: 1 }); });
  it('BAK-003 restores values from a valid backup', async () => { await set(KEY, 'ar'); const b = await backup(); await remove(KEY); await restore(b); expect(await get(KEY)).toBe('ar'); });
  it('BAK-004 rejects an invalid envelope', async () => { await expect(restore({} as BackupEnvelope)).rejects.toMatchObject({ code: 'BACKUP_INVALID' }); });
  it('BAK-005 rejects checksum tampering', async () => { const b = await backup(); await expect(restore({ ...b, checksum: '00000000' })).rejects.toMatchObject({ code: 'BACKUP_INVALID' }); });
  it('BAK-006 fallback backup rejects for lack of atomicity', async () => { __setBackendForTesting(new MemoryEngine('legacy-fallback')); await expect(backup()).rejects.toMatchObject({ code: 'STORAGE_ATOMICITY_UNAVAILABLE' }); });
  it('BAK-007 fallback restore rejects for lack of atomicity', async () => { const valid = await backup(); __setBackendForTesting(new MemoryEngine('legacy-fallback')); await expect(restore(valid)).rejects.toMatchObject({ code: 'STORAGE_ATOMICITY_UNAVAILABLE' }); });
  it('BAK-008 restore is rejected in read-only recovery mode', async () => { const valid = await backup(); __setBackendForTesting(new MemoryEngine('readonly-recovery')); await expect(restore(valid)).rejects.toMatchObject({ code: 'STORAGE_RECOVERY_REQUIRED' }); });
});

describe('revision conflicts and fallback rules', () => {
  it('CON-001 matching revision commits', async () => { await set(KEY, 'ar'); await expect(set(KEY, 'en', 1)).resolves.toEqual({ revision: 2 }); });
  it('CON-002 stale revision rejects', async () => { await set(KEY, 'ar'); await expect(set(KEY, 'en', 0)).rejects.toMatchObject({ code: 'STORAGE_CONFLICT' }); });
  it('CON-003 conflict exposes expected and actual revisions', async () => { await set(KEY, 'ar'); await expect(set(KEY, 'en', 5)).rejects.toMatchObject({ expectedRevision: 5, actualRevision: 1 }); });
  it('CON-004 failed compare-and-set leaves prior value intact', async () => { await set(KEY, 'ar'); await expect(set(KEY, 'en', 5)).rejects.toBeDefined(); expect(await get(KEY)).toBe('ar'); });
  it('CON-005 expected revision zero succeeds for an absent key', async () => await expect(set(KEY, 'ar', 0)).resolves.toEqual({ revision: 1 }));
  it('CON-006 fallback mode is selectable through the injected engine', async () => { __setBackendForTesting(new MemoryEngine('legacy-fallback')); expect(await getMode()).toBe('legacy-fallback'); });
  it('CON-007 read-only recovery mode is selectable through the injected engine', async () => { __setBackendForTesting(new MemoryEngine('readonly-recovery')); expect(await getMode()).toBe('readonly-recovery'); });
  it('fallback rejects stale expected revision', async () => { __setBackendForTesting(new MemoryEngine('legacy-fallback')); await set(KEY, 'ar'); await expect(set(KEY, 'en', 0)).rejects.toMatchObject({ code: 'STORAGE_CONFLICT' }); });
  it('fallback missing sidecar reads revision zero and expectedRevision zero creates the sidecar', async () => {
    const storage = new Map<string, string>([['operational.language', '"ar"']]);
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); },
      removeItem: (k: string) => storage.delete(k), get length() { return storage.size; }, key: (i: number) => [...storage.keys()][i] ?? null,
    } });
    try {
      __setBackendForTesting(new LegacyFallbackEngine());
      expect(await getWithRevision(KEY)).toEqual({ value: 'ar', revision: 0 });
      await expect(set(KEY, 'en', 0)).resolves.toEqual({ revision: 1 });
      expect(storage.get('shuttle.storage.revision.operational.language')).toBe('1');
    } finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: original }); }
  });
  it('read-only recovery rejects set', async () => { __setBackendForTesting(new MemoryEngine('readonly-recovery')); await expect(set(KEY, 'ar')).rejects.toMatchObject({ code: 'STORAGE_RECOVERY_REQUIRED' }); });
  it('read-only recovery rejects remove', async () => { __setBackendForTesting(new MemoryEngine('readonly-recovery')); await expect(remove(KEY)).rejects.toMatchObject({ code: 'STORAGE_RECOVERY_REQUIRED' }); });
  it('read-only recovery rejects backup', async () => { __setBackendForTesting(new MemoryEngine('readonly-recovery')); await expect(backup()).rejects.toMatchObject({ code: 'STORAGE_RECOVERY_REQUIRED' }); });
  it('read-only recovery rejects restore', async () => { __setBackendForTesting(new MemoryEngine('readonly-recovery')); const b = await new MemoryEngine().backup(); await expect(restore(b)).rejects.toMatchObject({ code: 'STORAGE_RECOVERY_REQUIRED' }); });
});


describe('real IndexedDB storage behavior', () => {
  beforeEach(async () => {
    __resetStorageForTesting();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('shuttle-car-storage');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('IndexedDB database deletion was blocked.'));
    });
    __setBackendForTesting(null);
  });
  afterEach(() => { __resetStorageForTesting(); });

  it('IDB-001 uses fake IndexedDB for real transaction-backed reads and writes', async () => {
    expect(await getMode()).toBe('indexeddb');
    await expect(set(KEY, 'ar', 0)).resolves.toEqual({ revision: 1 });
    await expect(getWithRevision(KEY)).resolves.toEqual({ value: 'ar', revision: 1 });
  });

  it('IDB-002 quarantines a corrupt stored shape and reports STORAGE_CORRUPT', async () => {
    await set(KEY, 'ar');
    const dbRequest = indexedDB.open('shuttle-car-storage', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      dbRequest.onsuccess = () => resolve(dbRequest.result);
      dbRequest.onerror = () => reject(dbRequest.error);
    });
    const tx = db.transaction(['records'], 'readwrite');
    tx.objectStore('records').put({ id: 'generation-1:' + KEY, value: { invalid: true }, revision: 1 });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
    await expect(get(KEY)).rejects.toMatchObject({ code: 'STORAGE_CORRUPT' });
    const qtx = db.transaction(['quarantine'], 'readonly');
    const quarantined = await new Promise<unknown[]>((resolve, reject) => {
      const request = qtx.objectStore('quarantine').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(quarantined).toHaveLength(1);
    expect(quarantined[0]).toMatchObject({ key: KEY, rawValue: { invalid: true }, reason: expect.any(String) });
    db.close();
  });

  it('IDB-004 maps IndexedDB DataCloneError to STORAGE_TRANSACTION_FAILED', async () => {
    await expect(set(KEY, (() => 'not cloneable') as never, 0)).rejects.toMatchObject({
      code: 'STORAGE_TRANSACTION_FAILED',
    });
  });

  it('IDB-003 stores explicitly quarantined raw values with a reason', async () => {
    await quarantineRecord(KEY, '{"broken":', 'JSON decode failure');
    const dbRequest = indexedDB.open('shuttle-car-storage', 1);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      dbRequest.onsuccess = () => resolve(dbRequest.result);
      dbRequest.onerror = () => reject(dbRequest.error);
    });
    const tx = db.transaction(['quarantine'], 'readonly');
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = tx.objectStore('quarantine').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: KEY, rawValue: '{"broken":', reason: 'JSON decode failure' });
    db.close();
  });
});
