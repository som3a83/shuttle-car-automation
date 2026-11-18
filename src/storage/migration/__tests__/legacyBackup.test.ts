import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createLegacyStorageBackup } from '../legacyBackup';

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
    expect(backup.records).toEqual([
      { key: 'private.audit.marker', value: '{"pending":true}' },
      { key: 'shuttle-car-automation-v1:local-accounts', value: '[{"username":"operator"}]' },
      { key: 'shuttle-car-automation-v7:shuttles', value: '[{"id":"SC-01"}]' }
    ]);
    expect(backup.sha256).toMatch(/^[a-f0-9]{64}$/);
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
});
