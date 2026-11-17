import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __closeForTesting, __resetStorageForTesting, __setBackendForTesting, setStorageModePreference, STORAGE_MODE_KEY, get } from '../../index';
import { AUDIT_ARCHIVE_PENDING_LEGACY_KEY, AUDIT_LEGACY_KEY_MAP } from '../legacyKeyMap';
import { getPreservedAuditArchivePendingMarker, importAuditData } from '../auditAdapter';

async function resetDatabase(): Promise<void> {
  __setBackendForTesting(null);
  __resetStorageForTesting();
  await __closeForTesting();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('shuttle-car-storage');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
  localStorage.clear();
  localStorage.removeItem(STORAGE_MODE_KEY);
  setStorageModePreference('auto');
}

beforeEach(async () => resetDatabase());
afterEach(async () => {
  await __closeForTesting();
  __resetStorageForTesting();
  localStorage.clear();
});

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}

async function sha256(value: unknown): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function validArchive(): Promise<Record<string, unknown>> {
  const unsignedRecord = {
    id: 'audit-archive-record-01',
    timestamp: '2026-11-17T10:00:00.000Z',
    actorId: 'user-01',
    actorRole: 'Admin',
    action: 'CREATE',
    entityType: 'shuttle',
    entityId: 'CS-01',
    previousHash: 'GENESIS'
  };
  const record = { ...unsignedRecord, hash: await sha256(unsignedRecord) };
  const records = [record];
  const unsignedArchive = {
    format: 'shuttle-audit-archive',
    version: 1,
    id: 'archive-01',
    archivedAt: '2026-11-17T11:00:00.000Z',
    previousArchiveHash: 'GENESIS',
    previousRecordHash: 'GENESIS',
    firstRecordId: record.id,
    lastRecordId: record.id,
    firstRecordHash: record.hash,
    lastRecordHash: record.hash,
    recordCount: 1,
    recordsDigest: await sha256(records),
    records
  };
  return { ...unsignedArchive, archiveHash: await sha256(unsignedArchive) };
}

describe('audit adapter', () => {
  it('AUD-010 imports active records and verified archive envelopes into separate keys', async () => {
    const archive = await validArchive();
    localStorage.setItem(AUDIT_LEGACY_KEY_MAP.active.legacyKey, JSON.stringify([]));
    localStorage.setItem(AUDIT_LEGACY_KEY_MAP.archives.legacyKey, JSON.stringify([archive]));
    const results = await importAuditData();
    expect(results.map((result) => result.status)).toEqual(['imported', 'imported']);
    await expect(get('audit.active')).resolves.toEqual([]);
    await expect(get('audit.archives')).resolves.toEqual([archive]);
  });

  it('AUD-011 preserves audit-archive-pending as a separate marker and refuses automatic import', async () => {
    const marker = JSON.stringify({ archive: { id: 'pending-01' } });
    localStorage.setItem(AUDIT_ARCHIVE_PENDING_LEGACY_KEY, marker);
    localStorage.setItem(AUDIT_LEGACY_KEY_MAP.active.legacyKey, JSON.stringify([]));
    localStorage.setItem(AUDIT_LEGACY_KEY_MAP.archives.legacyKey, JSON.stringify([]));
    const results = await importAuditData();
    expect(results.every((result) => result.status === 'invalid-source')).toBe(true);
    expect(getPreservedAuditArchivePendingMarker()).toBe(marker);
    expect(localStorage.getItem(AUDIT_ARCHIVE_PENDING_LEGACY_KEY)).toBe(marker);
    await expect(get('audit.active')).resolves.toBeNull();
    await expect(get('audit.archives')).resolves.toBeNull();
  });

  it('AUD-012 rejects a broken active audit hash chain without importing either collection', async () => {
    const invalidRecord = {
      id: 'bad-01',
      timestamp: '2026-11-17T10:00:00.000Z',
      actorId: 'user-01',
      actorRole: 'Admin',
      action: 'CREATE',
      entityType: 'shuttle',
      entityId: 'CS-01',
      previousHash: 'GENESIS',
      hash: 'not-a-real-hash'
    };
    localStorage.setItem(AUDIT_LEGACY_KEY_MAP.active.legacyKey, JSON.stringify([invalidRecord]));
    localStorage.setItem(AUDIT_LEGACY_KEY_MAP.archives.legacyKey, JSON.stringify([]));
    const results = await importAuditData();
    expect(results.every((result) => result.status === 'invalid-source')).toBe(true);
    await expect(get('audit.active')).resolves.toBeNull();
    await expect(get('audit.archives')).resolves.toBeNull();
  });
});
