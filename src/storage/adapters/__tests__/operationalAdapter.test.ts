import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __closeForTesting, __resetStorageForTesting, __setBackendForTesting, get, set } from '../../index';
import { OPERATIONAL_LEGACY_KEY_MAP } from '../legacyKeyMap';
import { importOperationalKey } from '../operationalAdapter';

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
}

beforeEach(async () => resetDatabase());
afterEach(async () => {
  await __closeForTesting();
  __resetStorageForTesting();
  localStorage.clear();
});

describe('operational adapter', () => {
  it('OPS-004 imports scalar preferences into their typed logical keys', async () => {
    const legacyKey = OPERATIONAL_LEGACY_KEY_MAP[0].legacyKey;
    localStorage.setItem(legacyKey, JSON.stringify('ar'));
    const result = await importOperationalKey(legacyKey);
    expect(result).toMatchObject({ status: 'imported', key: 'operational.language', value: 'ar', recordsCount: 1 });
    await expect(get('operational.language')).resolves.toBe('ar');
  });

  it('OPS-005 imports an operational collection and reports its record count', async () => {
    const legacyKey = OPERATIONAL_LEGACY_KEY_MAP[3].legacyKey;
    const shuttles = [{ id: 'CS-01', manufacturer: 'Cassioli' }, { id: 'AC-01', manufacturer: 'ACME' }];
    localStorage.setItem(legacyKey, JSON.stringify(shuttles));
    const result = await importOperationalKey(legacyKey);
    expect(result).toMatchObject({ status: 'imported', key: 'operational.shuttles', recordsCount: 2 });
    await expect(get('operational.shuttles')).resolves.toEqual(shuttles);
  });

  it('OPS-006 is idempotent when the same legacy value is imported twice', async () => {
    const legacyKey = OPERATIONAL_LEGACY_KEY_MAP[0].legacyKey;
    localStorage.setItem(legacyKey, JSON.stringify('ar'));
    expect((await importOperationalKey(legacyKey)).status).toBe('imported');
    expect((await importOperationalKey(legacyKey)).status).toBe('already-synced');
  });

  it('OPS-007 returns conflicts and invalid-source results without overwriting data', async () => {
    const languageKey = OPERATIONAL_LEGACY_KEY_MAP[0].legacyKey;
    localStorage.setItem(languageKey, JSON.stringify('ar'));
    await set('operational.language', 'en');
    const conflict = await importOperationalKey(languageKey);
    expect(conflict.status).toBe('conflict');
    await expect(get('operational.language')).resolves.toBe('en');

    const shuttlesKey = OPERATIONAL_LEGACY_KEY_MAP[3].legacyKey;
    localStorage.setItem(shuttlesKey, '{broken-json');
    expect((await importOperationalKey(shuttlesKey)).status).toBe('invalid-source');
    await expect(get('operational.shuttles')).resolves.toBeNull();
  });
});
