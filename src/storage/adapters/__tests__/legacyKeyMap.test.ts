import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __closeForTesting, __resetStorageForTesting, __setBackendForTesting } from '../../index';
import {
  AUDIT_ARCHIVE_PENDING_LEGACY_KEY,
  EXCLUDED_SESSION_STORAGE_KEY,
  LEGACY_KEY_MAP,
  assertLegacyImportKey,
  listImportableLegacyKeys,
  importMappedLegacyKey
} from '../legacyKeyMap';

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

describe('legacy key allow-list', () => {
  it('MAP-001 declares exactly the 17 importable legacy storage keys', () => {
    expect(listImportableLegacyKeys()).toHaveLength(17);
    expect(LEGACY_KEY_MAP.filter((entry) => entry.importable)).toHaveLength(17);
  });

  it('MAP-002 keeps the pending audit marker separate and excludes sessionStorage', () => {
    const pending = LEGACY_KEY_MAP.find((entry) => entry.legacyKey === AUDIT_ARCHIVE_PENDING_LEGACY_KEY);
    expect(pending).toMatchObject({ adapter: 'audit-marker', targetKey: null, importable: false });
    expect(LEGACY_KEY_MAP.some((entry) => entry.legacyKey === EXCLUDED_SESSION_STORAGE_KEY)).toBe(false);
  });

  it('MAP-004 distinguishes an absent legacy key from invalid JSON or shape data', async () => {
    const result = await importMappedLegacyKey(
      'shuttle-car-automation-v7:language',
      (value): value is 'en' | 'ar' => value === 'en' || value === 'ar',
      localStorage,
      undefined,
      'operational'
    );
    expect(result).toEqual({ status: 'missing-source', key: 'operational.language' });
  });

  it('MAP-003 rejects unknown, non-importable and session keys as programmer errors', () => {
    expect(() => assertLegacyImportKey('unknown:key')).toThrow('not approved');
    expect(() => assertLegacyImportKey(AUDIT_ARCHIVE_PENDING_LEGACY_KEY)).toThrow('not approved');
    expect(() => assertLegacyImportKey(EXCLUDED_SESSION_STORAGE_KEY)).toThrow('not approved');
  });
});
