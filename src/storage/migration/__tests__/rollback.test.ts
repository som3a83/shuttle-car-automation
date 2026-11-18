import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __closeForTesting,
  __resetStorageForTesting,
  createStagingContext,
  getStorageEngine,
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
  switchActiveGeneration
} from '../generation';
import { listImportableLegacyKeys, OPERATIONAL_LEGACY_KEY_MAP } from '../../adapters/legacyKeyMap';
import { assessMigrationRollback, rollbackToLegacyStorage } from '../rollback';
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
  setStorageModePreference('indexeddb');
  return snapshot;
}

describe('verified migration rollback', () => {
  it('allows rollback only while the legacy fingerprint and imported revisions still match', async () => {
    await createVerifiedMigrationSnapshot();

    const status = await assessMigrationRollback(localStorage);

    expect(status.eligible).toBe(true);
    expect(status.reason).toBeNull();
    expect(status.snapshot?.recordRevisions).toEqual({ 'operational.language': 1 });
  });

  it('refuses rollback after an application write changes a migrated record', async () => {
    await createVerifiedMigrationSnapshot();
    const engine = await getStorageEngine();
    await engine.write('operational.language', 'ar', 1);

    const status = await assessMigrationRollback(localStorage);

    expect(status.eligible).toBe(false);
    expect(status.reason).toMatch(/changed since migration/i);
    await expect(rollbackToLegacyStorage(localStorage)).rejects.toThrow(/changed since migration/i);
    expect(localStorage.getItem(STORAGE_MODE_KEY)).toBe('indexeddb');
  });

  it('refuses rollback if the preserved legacy source has changed', async () => {
    await createVerifiedMigrationSnapshot();
    localStorage.setItem(OPERATIONAL_LEGACY_KEY_MAP[0].legacyKey, JSON.stringify('ar'));

    const status = await assessMigrationRollback(localStorage);

    expect(status.eligible).toBe(false);
    expect(status.reason).toMatch(/legacy source no longer matches/i);
    await expect(rollbackToLegacyStorage(localStorage)).rejects.toThrow(/legacy source no longer matches/i);
  });

  it('atomically deactivates the migrated generation, retains it, and blocks stale-tab writes', async () => {
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
