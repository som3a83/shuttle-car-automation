import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __closeForTesting,
  __resetStorageForTesting,
  createStagingContext,
  setStorageModePreference
} from '../../index';
import {
  AUDIT_ARCHIVE_PENDING_LEGACY_KEY,
  AUTH_LEGACY_KEY_MAP,
  EXCLUDED_SESSION_STORAGE_KEY,
  LEGACY_KEY_MAP,
  OPERATIONAL_LEGACY_KEY_MAP,
  listImportableLegacyKeys
} from '../../adapters/legacyKeyMap';
import {
  closeMigrationDatabaseForTesting,
  createStagingGeneration,
  getActiveGeneration,
  getGenerationRecordCount,
  getMigrationJournal,
  saveMigrationJournal,
  acquireMigrationLock
} from '../generation';
import { migrateToIndexedDb, MIGRATION_KEY_ORDER } from '../orchestrator';
import { sha256Canonical } from '../verification';
import { MigrationState, type MigrationJournal } from '../types';

async function resetDatabase(): Promise<void> {
  await closeMigrationDatabaseForTesting();
  await __closeForTesting();
  __resetStorageForTesting();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('shuttle-car-storage');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
  localStorage.clear();
  sessionStorage.clear();
  setStorageModePreference('legacy');
}

beforeEach(async () => resetDatabase());
afterEach(async () => resetDatabase());

describe('explicit IndexedDB migration orchestrator', () => {
  it('migrates all 17 keys in the approved order and preserves the legacy source', async () => {
    const raw = JSON.stringify([{ id: 'CS-01', manufacturer: 'Cassioli' }]);
    localStorage.setItem(OPERATIONAL_LEGACY_KEY_MAP[3].legacyKey, raw);
    const before = await getActiveGeneration();

    const result = await migrateToIndexedDb({ migrationId: 'successful-migration', legacyStorage: localStorage });

    expect(result.success).toBe(true);
    expect(result.state).toBe(MigrationState.COMPLETE);
    expect(MIGRATION_KEY_ORDER).toHaveLength(17);
    expect(result.completedKeyCount).toBe(17);
    expect(await getActiveGeneration()).not.toBe(before);
    expect(await getGenerationRecordCount(await getActiveGeneration())).toBe(17);
    expect(localStorage.getItem(OPERATIONAL_LEGACY_KEY_MAP[3].legacyKey)).toBe(raw);
    const journal = await getMigrationJournal('successful-migration');
    expect(journal?.verificationStatus).toBe('passed');
    expect(journal?.state).toBe(MigrationState.COMPLETE);
    expect(journal?.sourceByKey?.['operational.shuttles']).toBe('legacy');
    expect(journal?.sourceByKey?.['operational.theme']).toBe('default');
  });

  it('Test 12: blocks migration while audit-archive-pending exists and preserves the marker', async () => {
    const marker = JSON.stringify({ pending: 'archive-01' });
    localStorage.setItem(AUDIT_ARCHIVE_PENDING_LEGACY_KEY, marker);
    const before = await getActiveGeneration();

    const result = await migrateToIndexedDb({ migrationId: 'pending-audit', legacyStorage: localStorage });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/audit-archive-pending/);
    expect(localStorage.getItem(AUDIT_ARCHIVE_PENDING_LEGACY_KEY)).toBe(marker);
    expect(await getActiveGeneration()).toBe(before);
  });

  it('Test 13: blocks a non-empty active IndexedDB destination', async () => {
    await createStagingContext('generation-1', 'preexisting-destination')
      .set('operational.language', 'ar', 0);
    const before = await getActiveGeneration();

    const result = await migrateToIndexedDb({ migrationId: 'non-empty-destination', legacyStorage: localStorage });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/destination is not empty/i);
    expect(await getActiveGeneration()).toBe(before);
    expect(await getGenerationRecordCount(before)).toBe(1);
  });

  it('Test 11: rejects an invalid account registry after staging earlier keys without switching the pointer', async () => {
    localStorage.setItem(AUTH_LEGACY_KEY_MAP.accounts.legacyKey, JSON.stringify([{ id: 'incomplete-account' }]));
    const before = await getActiveGeneration();

    const result = await migrateToIndexedDb({ migrationId: 'invalid-account-registry', legacyStorage: localStorage });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth.accounts: invalid-source/i);
    expect(result.state).toBe(MigrationState.FAILED);
    expect(await getActiveGeneration()).toBe(before);
    expect(await getGenerationRecordCount('generation-migration-invalid-account-registry')).toBe(12);
  });

  it('rejects a legacy source that differs from the confirmed backup fingerprint', async () => {
    const before = await getActiveGeneration();
    localStorage.setItem(OPERATIONAL_LEGACY_KEY_MAP[3].legacyKey, JSON.stringify([
      { id: 'SC-01', manufacturer: 'Cassioli' }
    ]));

    const result = await migrateToIndexedDb({
      migrationId: 'stale-confirmed-backup',
      legacyStorage: localStorage,
      expectedSourceFingerprint: '0'.repeat(64)
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/changed after the verified backup/i);
    expect(await getActiveGeneration()).toBe(before);
  });

  it('Test 8: blocks duplicate usernames in the local account registry', async () => {
    const account = (id: string, username: string) => ({
      id,
      name: 'Maintenance User',
      email: id + '@example.test',
      username,
      role: 'Admin',
      createdAt: '2026-11-18T10:00:00.000Z',
      passwordSalt: 'AAAAAAAAAAAAAAAAAAAAAA==',
      passwordHash: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
      iterations: 210000,
      failedAttempts: 0,
      lockedUntil: 0
    });
    localStorage.setItem(
      AUTH_LEGACY_KEY_MAP.accounts.legacyKey,
      JSON.stringify([account('account-1', 'same-user'), account('account-2', 'same-user')])
    );
    const result = await migrateToIndexedDb({ migrationId: 'duplicate-auth', legacyStorage: localStorage });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth.accounts: invalid-source/i);
    expect(await getActiveGeneration()).toBe('generation-1');
  });

  it('Tests 22 and 23: leaves legacy values and sessionStorage untouched and never imports the session key', async () => {
    const raw = JSON.stringify([{ id: 'CS-22' }]);
    localStorage.setItem(OPERATIONAL_LEGACY_KEY_MAP[3].legacyKey, raw);
    sessionStorage.setItem(EXCLUDED_SESSION_STORAGE_KEY, JSON.stringify({ session: 'do-not-migrate' }));

    const result = await migrateToIndexedDb({ migrationId: 'preservation-exclusion', legacyStorage: localStorage });

    expect(result.success).toBe(true);
    expect(localStorage.getItem(OPERATIONAL_LEGACY_KEY_MAP[3].legacyKey)).toBe(raw);
    expect(sessionStorage.getItem(EXCLUDED_SESSION_STORAGE_KEY)).toContain('do-not-migrate');
    expect(LEGACY_KEY_MAP.some((item) => item.legacyKey === EXCLUDED_SESSION_STORAGE_KEY)).toBe(false);
    expect(listImportableLegacyKeys()).toHaveLength(17);
    expect(await getGenerationRecordCount(await getActiveGeneration())).toBe(17);
  });

  it('Test 17: resumes an interrupted STAGING journal after the old lock lease expires', async () => {
    const migrationId = 'resume-test';
    const sourceRaw = JSON.stringify('ar');
    localStorage.setItem(OPERATIONAL_LEGACY_KEY_MAP[0].legacyKey, sourceRaw);
    const definitions = listImportableLegacyKeys();
    const fingerprintInput = definitions.map((entry) => ({
      key: entry.legacyKey,
      raw: localStorage.getItem(entry.legacyKey)
    }));
    const fingerprint = await sha256Canonical(fingerprintInput);
    const createdAt = new Date('2026-11-18T08:00:00.000Z');
    const resumedAt = new Date('2026-11-18T08:10:00.000Z');
    const generation = 'generation-migration-' + migrationId;

    await createStagingGeneration(generation, migrationId, createdAt.toISOString());
    await createStagingContext(generation, migrationId).set('operational.language', 'ar', 0);
    const journal: MigrationJournal & { previousGeneration: string } = {
      migrationId,
      state: MigrationState.STAGING,
      sourceFingerprint: fingerprint,
      expectedKeyCount: 17,
      completedKeyCount: 1,
      verificationStatus: 'pending',
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      stagingGeneration: generation,
      previousGeneration: 'generation-1',
      ownerToken: 'previous-owner'
    };
    await saveMigrationJournal(journal);
    await acquireMigrationLock(
      migrationId,
      'previous-owner',
      resumedAt.getTime() - 1000,
      resumedAt.getTime() - 10_000
    );

    const result = await migrateToIndexedDb({
      migrationId,
      ownerToken: 'resuming-owner',
      legacyStorage: localStorage,
      now: () => resumedAt
    });

    expect(result.success).toBe(true);
    expect(result.state).toBe(MigrationState.COMPLETE);
    expect(await getActiveGeneration()).toBe(generation);
  });

  it('Test 26: refuses migration without IndexedDB instead of silently falling back', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
    try {
      const result = await migrateToIndexedDb({ migrationId: 'no-fallback', legacyStorage: localStorage });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/refuses to fall back/i);
      expect(localStorage.getItem('shuttle-car-automation:storage-mode-preference')).toBe('legacy');
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'indexedDB', descriptor);
    }
  });

  it('Test 5: partial staging caused by a validation failure never activates the staged data', async () => {
    localStorage.setItem(AUTH_LEGACY_KEY_MAP.accounts.legacyKey, JSON.stringify([{ id: 'bad' }]));
    const before = await getActiveGeneration();
    const result = await migrateToIndexedDb({ migrationId: 'partial-staging', legacyStorage: localStorage });
    const journal = await getMigrationJournal('partial-staging');

    expect(result.success).toBe(false);
    expect(journal?.state).toBe(MigrationState.FAILED);
    expect(await getActiveGeneration()).toBe(before);
    expect(await getGenerationRecordCount(journal!.stagingGeneration)).toBe(12);
  });

  it('Test 7: a staging quota error is surfaced and never switches the active pointer', async () => {
    const originalPut = IDBObjectStore.prototype.put;
    let injected = false;
    IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
      const row = value as { id?: string } | null;
      if (!injected && row?.id?.startsWith('generation-migration-quota-test:')) {
        injected = true;
        throw new DOMException('Quota exceeded by test', 'QuotaExceededError');
      }
      return originalPut.call(this, value, key);
    };
    const before = await getActiveGeneration();
    try {
      const result = await migrateToIndexedDb({ migrationId: 'quota-test', legacyStorage: localStorage });
      expect(injected).toBe(true);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/STORAGE_QUOTA_EXCEEDED|quota/i);
      expect(await getActiveGeneration()).toBe(before);
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }
  });

  it('Test 6: a commit transaction interruption cannot partially switch the generation pointer', async () => {
    const originalPut = IDBObjectStore.prototype.put;
    let interrupted = false;
    IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
      const row = value as { key?: string } | null;
      if (!interrupted && row?.key === 'activeGeneration') {
        interrupted = true;
        throw new DOMException('Commit interrupted by test', 'AbortError');
      }
      return originalPut.call(this, value, key);
    };
    const before = await getActiveGeneration();
    try {
      const result = await migrateToIndexedDb({ migrationId: 'commit-interruption', legacyStorage: localStorage });
      expect(interrupted).toBe(true);
      expect(result.success).toBe(false);
      expect(await getActiveGeneration()).toBe(before);
      expect(await getGenerationRecordCount('generation-migration-commit-interruption')).toBe(17);
    } finally {
      IDBObjectStore.prototype.put = originalPut;
    }
  });
});
