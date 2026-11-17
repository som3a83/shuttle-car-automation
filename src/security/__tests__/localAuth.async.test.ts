import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  authenticateLocalAccountAsync,
  changeLocalAccountPasswordAsync,
  createLocalAccountAsync,
  listLocalAccounts,
  listLocalAccountsAsync,
  localAccountRegistryErrorAsync,
  readLocalSession,
  setLocalAccountDisabledAsync,
  updateLocalAccountAsync
} from '../localAuth.ts';
import { LegacyFallbackEngine, StorageError } from '../../storage/index.ts';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
  removeItem(key: string): void { this.values.delete(key); }
}

const cryptoApi = webcrypto as unknown as Crypto;
const initialAdmin = {
  name: 'Async Local Administrator',
  email: 'async-admin@example.test',
  username: 'async-admin',
  role: 'Super Admin' as const,
  password: 'Async-Administrator-Password-2026!'
};

let storage: MemoryStorage;
let sessions: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  sessions = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('sessionStorage', sessions);
  vi.stubGlobal('crypto', webcrypto);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('async local account backend', () => {
  it('persists accounts through the async API while preserving synchronous compatibility reads and session storage', async () => {
    const admin = await createLocalAccountAsync(initialAdmin, cryptoApi);
    expect(admin.role).toBe('Super Admin');
    const rawAdmin = JSON.parse(storage.getItem('shuttle-car-automation-v1:local-accounts') || '[]')[0];
    expect(rawAdmin.iterations).toBe(210_000);
    expect(atob(rawAdmin.passwordSalt)).toHaveLength(16);
    expect(atob(rawAdmin.passwordHash)).toHaveLength(32);
    expect(rawAdmin.credentialVersion).toBe(1);
    expect(storage.getItem('shuttle-car-automation-v1:local-accounts')).not.toBeNull();
    expect(listLocalAccounts(storage).map((account) => account.id)).toEqual([admin.id]);
    expect((await listLocalAccountsAsync()).map((account) => account.id)).toEqual([admin.id]);
    expect(await localAccountRegistryErrorAsync()).toBeNull();

    const viewer = await createLocalAccountAsync({
      name: 'Async Viewer',
      email: 'async-viewer@example.test',
      username: 'async-viewer',
      role: 'Viewer',
      password: 'Async-Viewer-Password-2026!'
    }, cryptoApi, new Date(), { id: admin.id, role: admin.role });

    const signIn = await authenticateLocalAccountAsync(
      initialAdmin.username, initialAdmin.password, sessions, cryptoApi
    );
    expect(signIn.ok).toBe(true);
    if (!signIn.ok) return;
    expect(readLocalSession(sessions, storage, signIn.session.issuedAt + 1)?.accountId).toBe(admin.id);

    const edited = await updateLocalAccountAsync(viewer.id, {
      name: 'Updated Async Viewer',
      email: 'updated-viewer@example.test',
      username: 'updated-viewer'
    }, { id: admin.id, role: admin.role });
    expect(edited.name).toBe('Updated Async Viewer');

    await setLocalAccountDisabledAsync(viewer.id, true, { id: admin.id, role: admin.role });
    expect((await listLocalAccountsAsync()).find((account) => account.id === viewer.id)?.disabledAt).toBeTruthy();

    const nextPassword = 'Async-Administrator-New-Password-2026!';
    await changeLocalAccountPasswordAsync(
      admin.id, initialAdmin.password, nextPassword, { id: admin.id, role: admin.role }, cryptoApi
    );
    expect(readLocalSession(sessions, storage)).toBeNull();
    expect((await authenticateLocalAccountAsync('async-admin', nextPassword, sessions, cryptoApi)).ok).toBe(true);
    expect(await localAccountRegistryErrorAsync()).toBeNull();
    const activeSession = await import('../localAuth.ts').then(({ readLocalSessionAsync }) => readLocalSessionAsync(sessions));
    expect(activeSession?.accountId).toBe(admin.id);
    expect(activeSession?.credentialVersion).toBe(2);
  });

  it('enforces the five-failure lockout and rejects short passwords', async () => {
    await createLocalAccountAsync(initialAdmin, cryptoApi);
    await expect(createLocalAccountAsync({
      ...initialAdmin, username: 'short-pass', email: 'short@example.test', password: 'too-short'
    }, cryptoApi)).rejects.toThrow(/12–128/);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await authenticateLocalAccountAsync('async-admin', 'wrong-password', sessions, cryptoApi, 10_000 + attempt);
      expect(result.ok).toBe(false);
    }
    const locked = await authenticateLocalAccountAsync('async-admin', initialAdmin.password, sessions, cryptoApi, 10_006);
    expect(locked).toEqual({ ok: false, reason: 'locked' });
    const account = JSON.parse(storage.getItem('shuttle-car-automation-v1:local-accounts') || '[]')[0];
    expect(account.failedAttempts).toBe(0);
    expect(account.lockedUntil).toBe(70_004);
  });

  it('retries a revision conflict without overwriting the existing account registry', async () => {
    const originalWrite = LegacyFallbackEngine.prototype.write;
    let conflicts = 0;
    LegacyFallbackEngine.prototype.write = async function(key, value, revision) {
      if (key === 'auth.accounts' && conflicts === 0) {
        conflicts += 1;
        throw new StorageError({
          code: 'STORAGE_CONFLICT',
          message: 'Simulated concurrent account write.',
          key,
          expectedRevision: revision,
          actualRevision: (revision ?? 0) + 1
        });
      }
      return originalWrite.call(this, key, value, revision);
    };

    try {
      const created = await createLocalAccountAsync(initialAdmin, cryptoApi);
      expect(created.username).toBe('async-admin');
      expect(conflicts).toBe(1);
      expect((await listLocalAccountsAsync()).map((account) => account.username)).toEqual(['async-admin']);
    } finally {
      LegacyFallbackEngine.prototype.write = originalWrite;
    }
  });
});
