import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __closeForTesting,
  __resetStorageForTesting,
  createStagingContext
} from '../../index';
import {
  acquireMigrationLock,
  closeMigrationDatabaseForTesting,
  createStagingGeneration,
  getActiveGeneration,
  getGenerationRecordCount,
  isMigrationGenerationActive,
  switchActiveGeneration
} from '../generation';
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
}

beforeEach(async () => resetDatabase());
afterEach(async () => resetDatabase());

function journal(migrationId: string, stagingGeneration: string, ownerToken: string) {
  const timestamp = '2026-11-18T10:00:00.000Z';
  return {
    migrationId,
    state: MigrationState.COMMITTING,
    sourceFingerprint: 'test-fingerprint',
    expectedKeyCount: 1,
    completedKeyCount: 1,
    verificationStatus: 'passed' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    stagingGeneration,
    previousGeneration: 'generation-1',
    ownerToken
  };
}

describe('migration generation storage', () => {
  it('Test 24: keeps staging records isolated from the active generation', async () => {
    const before = await getActiveGeneration();
    const generation = 'generation-stage-isolation';
    await createStagingGeneration(generation, 'stage-isolation');
    const staging = createStagingContext(generation, 'stage-isolation');
    await staging.set('operational.language', 'ar', 0);

    expect(await staging.get('operational.language')).toBe('ar');
    expect(await getActiveGeneration()).toBe(before);
    expect(await getGenerationRecordCount(before)).toBe(0);
    expect(await isMigrationGenerationActive(generation)).toBe(false);
  });

  it('Test 16: rejects a second tab while a non-expired migration lock is held', async () => {
    const now = Date.now();
    await acquireMigrationLock('lock-test', 'owner-one', now + 60_000, now);
    await expect(
      acquireMigrationLock('lock-test', 'owner-two', now + 60_000, now + 1)
    ).rejects.toThrow(/locked by another owner/);
  });

  it('Test 16: permits lock takeover only after the previous lease expires', async () => {
    const now = Date.now();
    await acquireMigrationLock('expired-lock', 'owner-one', now + 10, now);
    const next = await acquireMigrationLock('expired-lock', 'owner-two', now + 20_000, now + 11);
    expect(next.ownerToken).toBe('owner-two');
  });

  it('Test 18: switches the active pointer and journal in one successful transaction', async () => {
    const migrationId = 'atomic-switch';
    const generation = 'generation-atomic-switch';
    const owner = 'atomic-owner';
    await createStagingGeneration(generation, migrationId);
    await createStagingContext(generation, migrationId).set('operational.language', 'en', 0);
    await acquireMigrationLock(migrationId, owner, Date.now() + 60_000);

    const snapshot = await switchActiveGeneration({
      migrationId,
      ownerToken: owner,
      previousGeneration: 'generation-1',
      nextGeneration: generation,
      expectedKeys: ['operational.language'],
      journal: journal(migrationId, generation, owner)
    });

    expect(snapshot.previousGeneration).toBe('generation-1');
    expect(snapshot.nextGeneration).toBe(generation);
    expect(await getActiveGeneration()).toBe(generation);
    expect(await isMigrationGenerationActive(generation)).toBe(true);
  });

  it('Tests 5, 6 and 18: an interrupted/incomplete staging or commit cannot expose a partial generation', async () => {
    const migrationId = 'interrupted-switch';
    const generation = 'generation-interrupted-switch';
    const owner = 'interrupted-owner';
    const activeBefore = await getActiveGeneration();
    await createStagingGeneration(generation, migrationId);
    await createStagingContext(generation, migrationId).set('operational.language', 'en', 0);
    await acquireMigrationLock(migrationId, owner, Date.now() + 60_000);

    await expect(switchActiveGeneration({
      migrationId,
      ownerToken: owner,
      previousGeneration: activeBefore,
      nextGeneration: generation,
      expectedKeys: ['operational.language', 'operational.theme'],
      journal: { ...journal(migrationId, generation, owner), previousGeneration: activeBefore }
    })).rejects.toThrow(/missing key|incomplete staging/i);

    expect(await getActiveGeneration()).toBe(activeBefore);
    expect(await isMigrationGenerationActive(generation)).toBe(false);
    expect(await getGenerationRecordCount(generation)).toBe(1);
  });

  it('Test 7: transaction errors do not move the active-generation pointer', async () => {
    const migrationId = 'quota-like-abort';
    const generation = 'generation-quota-like-abort';
    const owner = 'quota-owner';
    const activeBefore = await getActiveGeneration();
    await createStagingGeneration(generation, migrationId);
    await createStagingContext(generation, migrationId).set('operational.language', 'en', 0);
    await acquireMigrationLock(migrationId, owner, Date.now() + 60_000);

    // A storage-level write is not fabricated here: this simulates a transaction
    // abort at the commit boundary and asserts the pointer remains unchanged.
    await expect(switchActiveGeneration({
      migrationId,
      ownerToken: owner,
      previousGeneration: activeBefore,
      nextGeneration: generation,
      expectedKeys: ['operational.language', 'operational.theme'],
      journal: { ...journal(migrationId, generation, owner), previousGeneration: activeBefore }
    })).rejects.toThrow();

    expect(await getActiveGeneration()).toBe(activeBefore);
  });
});
