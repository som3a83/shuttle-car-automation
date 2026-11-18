import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __closeForTesting,
  __resetStorageForTesting,
  createStagingContext,
  getStorageEngine,
  getWithRevision,
  getStorageModePreference,
  setStorageModePreference,
  STORAGE_MODE_KEY
} from '../../index';
import {
  acquireMigrationLock,
  closeMigrationDatabaseForTesting,
  createStagingGeneration,
  getActiveGeneration,
  getGenerationRecordCount,
  releaseMigrationLock,
  saveMigrationJournal,
  switchActiveGeneration
} from '../generation';
import {
  listImportableLegacyKeys,
  OPERATIONAL_LEGACY_KEY_MAP
} from '../../adapters/legacyKeyMap';
import { assessMigrationRollback, rollbackToLegacyStorage, type LegacyStorageRollbackAdapter } from '../rollback';
import { sha256Canonical } from '../verification';
import { MigrationState } from '../types';

async function resetDatabase(): Promise<void> {
  await closeMigrationDatabaseForTesting();
  await __closeForTesting();
  __resetStorageForTesting();
  localStorage.clear();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('shuttle-car-storage');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

beforeEach(async () => resetDatabase());
afterEach(async () => resetDatabase());

async function createVerifiedMigrationSnapshot() {
  localStorage.setItem(OPERATIONAL_LEGACY_KEY_MAP[0].legacyKey, JSON.stringify('en'));
  const sourceValues = listImportableLegacyKeys().map((entry) => ({
    key: entry.legacyKey,
    raw: localStorage.getItem(entry.legacyKey)
  }));
  const sourceFingerprint = await sha256Canonical(sourceValues);
  const migrationId = 'rollback-test';
  const generation = 'generation-migration-' + migrationId;
  const owner = 'rollback-test-owner';
  const createdAt = '2026-11-18T10:00:00.000Z';

  await createStagingGeneration(generation, migrationId, createdAt);
  await createStagingContext(generation, migrationId).set('operational.language', 'en', 0);
  await acquireMigrationLock(migrationId, owner, Date.now() + 60_000);
  const snapshot = await switchActiveGeneration({
    migrationId,
    ownerToken: owner,
    previousGeneration: 'generation-1',
    nextGeneration: generation,
    expectedKeys: ['operational.language'],
    journal: {
      migrationId,
      state: MigrationState.COMMITTING,
      sourceFingerprint,
      expectedKeyCount: 1,
      completedKeyCount: 1,
      verificationStatus: 'passed',
      createdAt,
      updatedAt: createdAt,
      stagingGeneration: generation,
      previousGeneration: 'generation-1',
      ownerToken: owner
    }
  });
  await releaseMigrationLock(migrationId, owner);
  await saveMigrationJournal({
    migrationId,
    state: MigrationState.COMPLETE,
    sourceFingerprint,
    expectedKeyCount: 1,
    completedKeyCount: 1,
    verificationStatus: 'passed',
    createdAt,
    updatedAt: createdAt,
    stagingGeneration: generation,
    previousGeneration: 'generation-1',
    ownerToken: owner
  });
  setStorageModePreference('indexeddb');
  return snapshot;
}

function failingStorageAdapter(shouldFail: (key: string, value: string) => boolean): LegacyStorageRollbackAdapter {
  return {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => {
      if (shouldFail(key, value)) throw new Error('Simulated localStorage quota/write interruption.');
      localStorage.setItem(key, value);
    }
  };
}

describe('verified reverse migration to legacy storage', () => {
  it('blocks reverse migration while a previous forward migration journal is incomplete', async () => {
    await createVerifiedMigrationSnapshot();
    await saveMigrationJournal({
      migrationId: 'rollback-test',
      state: MigrationState.STAGING,
      sourceFingerprint: 'incomplete-source',
      expectedKeyCount: 17,
      completedKeyCount: 4,
      verificationStatus: 'pending',
      createdAt: '2026-11-18T10:00:00.000Z',
      updatedAt: '2026-11-18T10:01:00.000Z',
      stagingGeneration: 'generation-migration-rollback-test',
      previousGeneration: 'generation-1',
      ownerToken: 'rollback-test-owner'
    });

    const status = await assessMigrationRollback(localStorage);

    expect(status.eligible).toBe(false);
    expect(status.reason).toMatch(/unfinished storage migration journal/i);
    expect(getStorageModePreference()).toBe('indexeddb');
  });

  it('preflights all 17 approved keys and supplies defaults for missing IndexedDB records', async () => {
    await createVerifiedMigrationSnapshot();

    const status = await assessMigrationRollback(localStorage);

    expect(status.eligible).toBe(true);
    expect(status.reason).toBeNull();
    expect(status.keyCount).toBe(17);
    expect(status.defaultedKeyCount).toBe(16);
    expect(status.snapshot?.recordRevisions).toEqual({ 'operational.language': 1 });
  });

  it('copies operational writes made after migration back to legacy storage before switching mode', async () => {
    await createVerifiedMigrationSnapshot();
    const engine = await getStorageEngine();
    await engine.write('operational.language', 'ar', 1);

    const result = await rollbackToLegacyStorage(localStorage);

    expect(result.writtenKeyCount).toBe(17);
    expect(localStorage.getItem(OPERATIONAL_LEGACY_KEY_MAP[0].legacyKey)).toBe(JSON.stringify('ar'));
    expect(JSON.parse(localStorage.getItem(OPERATIONAL_LEGACY_KEY_MAP[1].legacyKey) || 'null')).toBe('light');
    expect(getStorageModePreference()).toBe('indexeddb'); // The active engine is pinned until reload.
    expect(localStorage.getItem(STORAGE_MODE_KEY)).toBe('legacy');
  });

  it('blocks corrupted legacy JSON during pre-flight without changing the selected backend', async () => {
    await createVerifiedMigrationSnapshot();
    const corruptKey = OPERATIONAL_LEGACY_KEY_MAP[1].legacyKey;
    localStorage.setItem(corruptKey, '{broken-json');

    const status = await assessMigrationRollback(localStorage);

    expect(status.eligible).toBe(false);
    expect(status.reason).toMatch(/corrupted JSON/i);
    await expect(rollbackToLegacyStorage(localStorage)).rejects.toThrow(/corrupted JSON/i);
    expect(getStorageModePreference()).toBe('indexeddb');
    expect(localStorage.getItem(STORAGE_MODE_KEY)).toBe('indexeddb');
    expect(localStorage.getItem(corruptKey)).toBe('{broken-json');
  });

  it('resumes safely after an interrupted legacy write and never loses the active IndexedDB copy', async () => {
    const snapshot = await createVerifiedMigrationSnapshot();
    const engine = await getStorageEngine();
    await engine.write('operational.language', 'ar', 1);

    const interrupted = failingStorageAdapter((key) => key === OPERATIONAL_LEGACY_KEY_MAP[3].legacyKey);
    await expect(rollbackToLegacyStorage(interrupted)).rejects.toThrow(/Simulated localStorage/i);

    expect(getStorageModePreference()).toBe('indexeddb');
    expect((await getWithRevision('operational.language'))?.value).toBe('ar');
    expect(await getActiveGeneration()).toBe(snapshot.nextGeneration);

    const resumed = await rollbackToLegacyStorage(localStorage);
    expect(resumed.writtenKeyCount).toBe(17);
    expect(JSON.parse(localStorage.getItem(OPERATIONAL_LEGACY_KEY_MAP[0].legacyKey) || 'null')).toBe('ar');
    expect(getStorageModePreference()).toBe('legacy');
  });

  it('keeps IndexedDB selected when reverse migration cannot write the legacy destination', async () => {
    await createVerifiedMigrationSnapshot();
    const interrupted = failingStorageAdapter((key) => key.startsWith('shuttle.storage.rollback.staging.'));
    await expect(rollbackToLegacyStorage(interrupted)).rejects.toThrow(/Simulated localStorage/i);

    expect(getStorageModePreference()).toBe('indexeddb');
    expect((await getWithRevision('operational.language'))?.value).toBe('en');
    expect(await getActiveGeneration()).toBe('generation-migration-rollback-test');
  });

  it('shares one reverse-migration promise across duplicate triggers (StrictMode / double click)', async () => {
    await createVerifiedMigrationSnapshot();

    const first = rollbackToLegacyStorage(localStorage);
    const duplicate = rollbackToLegacyStorage(localStorage);

    expect(duplicate).toBe(first);
    const result = await first;
    expect(result.writtenKeyCount).toBe(17);
    expect(localStorage.getItem(STORAGE_MODE_KEY)).toBe('legacy');
  });

  it('retains the migrated generation and blocks stale IndexedDB writes after successful rollback', async () => {
    const snapshot = await createVerifiedMigrationSnapshot();
    const staleTabEngine = await getStorageEngine();

    const result = await rollbackToLegacyStorage(localStorage);

    expect(result.snapshot.id).toBe(snapshot.id);
    expect(result.snapshot.rolledBackAt).toBeTruthy();
    expect(result.rollbackGeneration).toMatch(/^generation-rollback-/);
    expect(await getActiveGeneration()).toBe(result.rollbackGeneration);
    expect(await getGenerationRecordCount(snapshot.nextGeneration)).toBe(1);
    expect(await getGenerationRecordCount(result.rollbackGeneration)).toBe(0);
    expect(localStorage.getItem(STORAGE_MODE_KEY)).toBe('legacy');
    await expect(staleTabEngine.write('operational.language', 'ar')).rejects.toThrow(/rolled back/i);
  });
});
