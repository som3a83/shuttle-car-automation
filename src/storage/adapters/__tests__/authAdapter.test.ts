import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __closeForTesting, __resetStorageForTesting, __setBackendForTesting, get } from '../../index';
import { AUTH_LEGACY_KEY_MAP, EXCLUDED_SESSION_STORAGE_KEY, LEGACY_KEY_MAP } from '../legacyKeyMap';
import { importAuthData } from '../authAdapter';

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
  sessionStorage.clear();
}

beforeEach(async () => resetDatabase());
afterEach(async () => {
  await __closeForTesting();
  __resetStorageForTesting();
  localStorage.clear();
  sessionStorage.clear();
});

const account = {
  id: 'account-01',
  name: 'Maintenance Admin',
  email: 'admin@example.test',
  username: 'maint-admin',
  role: 'Admin',
  createdAt: '2026-11-17T10:00:00.000Z',
  passwordSalt: 'AAAAAAAAAAAAAAAAAAAAAA==',
  passwordHash: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  iterations: 210000,
  failedAttempts: 0,
  lockedUntil: 0
};

describe('auth adapter', () => {
  it('AUTH-008 imports the persistent account registry without stripping credential fields', async () => {
    localStorage.setItem(AUTH_LEGACY_KEY_MAP.accounts.legacyKey, JSON.stringify([account]));
    const result = await importAuthData();
    expect(result).toMatchObject({ status: 'imported', key: 'auth.accounts', recordsCount: 1 });
    await expect(get('auth.accounts')).resolves.toEqual([account]);
  });

  it('AUTH-009 excludes the sessionStorage session from migration', async () => {
    localStorage.setItem(AUTH_LEGACY_KEY_MAP.accounts.legacyKey, JSON.stringify([]));
    sessionStorage.setItem(EXCLUDED_SESSION_STORAGE_KEY, JSON.stringify({ token: 'session-secret' }));
    expect(LEGACY_KEY_MAP.some((entry) => entry.legacyKey === EXCLUDED_SESSION_STORAGE_KEY)).toBe(false);
    await importAuthData();
    expect(sessionStorage.getItem(EXCLUDED_SESSION_STORAGE_KEY)).toContain('session-secret');
    await expect(get('auth.accounts')).resolves.toEqual([]);
  });
});
