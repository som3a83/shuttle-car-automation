import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createLegacyStorageBackup } from '../legacyBackup';
import { listImportableLegacyKeys } from '../../adapters/legacyKeyMap';
import { sha256Canonical } from '../verification';

function createStorage(values: Record<string, string>): Storage {
  const entries = Object.entries(values);
  return {
    get length() { return entries.length; },
    key(index: number) { return entries[index]?.[0] ?? null; },
    getItem(key: string) { return values[key] ?? null; }
  } as Storage;
}

describe('complete legacy localStorage migration backup', () => {
  it('exports every key and preserves exact raw values in deterministic key order', async () => {
    const storage = createStorage({
      'shuttle-car-automation-v7:shuttles': '[{"id":"SC-01"}]',
      'shuttle-car-automation-v1:local-accounts': '[{"username":"operator"}]',
      'private.audit.marker': '{"pending":true}'
    });
    const backup = await createLegacyStorageBackup(
      storage,
      webcrypto as unknown as Crypto,
      new Date('2026-11-18T12:00:00.000Z')
    );

    expect(backup).toMatchObject({
      format: 'shuttle-legacy-storage-backup',
      schemaVersion: 1,
      exportedAt: '2026-11-18T12:00:00.000Z',
      source: 'window.localStorage',
      recordCount: 3
    });
    expect(backup.migrationSourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
    const expectedFingerprint = await sha256Canonical(
      listImportableLegacyKeys().map((definition) => ({
        key: definition.legacyKey,
        raw: storage.getItem(definition.legacyKey)
      })),
      webcrypto as unknown as Crypto
    );
    expect(backup.migrationSourceFingerprint).toBe(expectedFingerprint);
    expect(backup.records).toEqual([
      { key: 'private.audit.marker', value: '{"pending":true}' },
      { key: 'shuttle-car-automation-v1:local-accounts', value: '[{"username":"operator"}]' },
      { key: 'shuttle-car-automation-v7:shuttles', value: '[{"id":"SC-01"}]' }
    ]);
    expect(backup.sha256).toMatch(/^[a-f0-9]{64}$/);
    const { sha256, ...payload } = backup;
    const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    const expectedDigest = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    expect(sha256).toBe(expectedDigest);
  });

  it('fails closed if a key disappears while the backup is being read', async () => {
    const storage = {
      length: 1,
      key: () => 'raced-key',
      getItem: () => null
    } as unknown as Storage;
    await expect(createLegacyStorageBackup(storage, webcrypto as unknown as Crypto))
      .rejects.toThrow(/changed while creating the backup/);
  });

  it('refuses an unverified backup when Web Crypto is unavailable', async () => {
    const storage = createStorage({ one: 'value' });
    await expect(createLegacyStorageBackup(storage, {} as Crypto))
      .rejects.toThrow(/Web Crypto SHA-256 is unavailable/);
  });

  it('rejects data changing during the separate migration-fingerprint pass', async () => {
    const targetKey = listImportableLegacyKeys()[0].legacyKey;
    let reads = 0;
    const storage = {
      get length() { return 1; },
      key: () => targetKey,
      getItem: (key: string) => {
        if (key !== targetKey) return null;
        reads += 1;
        return reads <= 2 ? JSON.stringify('stable-value') : JSON.stringify('changed-value');
      }
    } as unknown as Storage;

    await expect(createLegacyStorageBackup(storage, webcrypto as unknown as Crypto))
      .rejects.toThrow(/changed while creating the backup/);
  });

  it('rejects a localStorage snapshot changed during backup creation', async () => {
    let readCount = 0;
    const storage = {
      get length() { return 1; },
      key: () => 'moving-key',
      getItem: () => {
        readCount += 1;
        return readCount === 1 ? 'first-value' : 'changed-value';
      }
    } as unknown as Storage;

    await expect(createLegacyStorageBackup(storage, webcrypto as unknown as Crypto))
      .rejects.toThrow(/changed while creating the backup/);
  });
});
