import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  appendAuditRecordAsync,
  archiveAuditRecordsAsync,
  AUDIT_ARCHIVE_PENDING_KEY,
  AUDIT_ARCHIVE_STORAGE_KEY,
  AUDIT_STORAGE_KEY,
  readAllAuditRecordsAsync,
  readAuditRecordsAsync,
  recoverPendingAuditArchiveAsync,
  verifyAuditLedgerAsync
} from './auditLog.ts';
import { LegacyFallbackEngine, StorageError } from '../storage/index.ts';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  failNextKey: string | null = null;
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.failNextKey === key) {
      this.failNextKey = null;
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    }
    this.values.set(key, String(value));
  }
  removeItem(key: string): void { this.values.delete(key); }
}

const cryptoApi = webcrypto as unknown as Crypto;
const event = (action: string, entityId = 'SC-ASYNC-01') => ({
  actorId: 'async-admin',
  actorRole: 'Super Admin',
  action,
  entityType: 'shuttle',
  entityId,
  detail: 'Async audit test'
});

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('crypto', webcrypto);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('async audit backend', () => {
  it('serializes concurrent same-tab appends and maintains the SHA-256 chain', async () => {
    const records = await Promise.all([
      appendAuditRecordAsync(event('async-created'), new Date('2026-11-17T10:00:00.000Z'), cryptoApi),
      appendAuditRecordAsync(event('async-updated'), new Date('2026-11-17T10:01:00.000Z'), cryptoApi),
      appendAuditRecordAsync(event('async-checked'), new Date('2026-11-17T10:02:00.000Z'), cryptoApi)
    ]);

    expect(records).toHaveLength(3);
    const active = await readAuditRecordsAsync(cryptoApi);
    expect(active.map((record) => record.action)).toEqual([
      'async-created', 'async-updated', 'async-checked'
    ]);
    expect(active[1].previousHash).toBe(active[0].hash);
    expect(active[2].previousHash).toBe(active[1].hash);
    expect((await verifyAuditLedgerAsync(cryptoApi)).valid).toBe(true);
    expect((await readAllAuditRecordsAsync(cryptoApi)).map((record) => record.action)).toEqual([
      'async-created', 'async-updated', 'async-checked'
    ]);
  });

  it('rebuilds the audit record after a revision conflict and retries up to success', async () => {
    const originalWrite = LegacyFallbackEngine.prototype.write;
    let conflicts = 0;
    LegacyFallbackEngine.prototype.write = async function(key, value, revision) {
      if (key === 'audit.active' && conflicts === 0) {
        conflicts += 1;
        throw new StorageError({
          code: 'STORAGE_CONFLICT',
          message: 'Simulated concurrent audit append.',
          key,
          expectedRevision: revision,
          actualRevision: (revision ?? 0) + 1
        });
      }
      return originalWrite.call(this, key, value, revision);
    };

    try {
      const record = await appendAuditRecordAsync(event('retried-event'), new Date(), cryptoApi);
      expect(conflicts).toBe(1);
      expect(record.action).toBe('retried-event');
      expect((await readAuditRecordsAsync(cryptoApi)).map((item) => item.id)).toContain(record.id);
      expect((await verifyAuditLedgerAsync(cryptoApi)).valid).toBe(true);
    } finally {
      LegacyFallbackEngine.prototype.write = originalWrite;
    }
  });

  it('retains the pending archive marker after a failed write and recovers without losing records', async () => {
    await appendAuditRecordAsync(event('archive-one'), new Date('2026-11-17T11:00:00.000Z'), cryptoApi);
    await appendAuditRecordAsync(event('archive-two'), new Date('2026-11-17T11:01:00.000Z'), cryptoApi);
    storage.failNextKey = AUDIT_ARCHIVE_STORAGE_KEY;

    await expect(archiveAuditRecordsAsync(new Date('2026-11-17T11:02:00.000Z'), cryptoApi)).rejects.toMatchObject({
      code: 'STORAGE_QUOTA_EXCEEDED'
    });
    expect(storage.getItem(AUDIT_ARCHIVE_PENDING_KEY)).not.toBeNull();
    expect(JSON.parse(storage.getItem(AUDIT_STORAGE_KEY) || '[]')).toHaveLength(2);

    expect(await recoverPendingAuditArchiveAsync(storage, cryptoApi)).toBe(true);
    expect(storage.getItem(AUDIT_ARCHIVE_PENDING_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(AUDIT_ARCHIVE_STORAGE_KEY) || '[]')).toHaveLength(1);
    expect(JSON.parse(storage.getItem(AUDIT_STORAGE_KEY) || '[]')).toHaveLength(0);
    expect((await readAllAuditRecordsAsync(cryptoApi)).map((record) => record.action)).toEqual([
      'archive-one', 'archive-two'
    ]);
    expect((await verifyAuditLedgerAsync(cryptoApi)).valid).toBe(true);
  });
});
