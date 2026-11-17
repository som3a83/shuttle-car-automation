import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateLocalAccount, changeLocalAccountPassword, createLocalAccount, endLocalSession,
  listLocalAccounts, setLocalAccountDisabled, updateLocalAccount,
  LOCAL_AUTH_STORAGE_KEY, LOCAL_SESSION_STORAGE_KEY, localAccountRegistryError, readLocalSession
} from './localAuth.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const account = {
  name: 'Local Administrator', email: 'admin@example.local', username: 'admin',
  role: 'Super Admin', password: 'A-very-long-local-passphrase-2026'
};

test('local account stores a derived password hash, never the plaintext password', async () => {
  const storage = new MemoryStorage();
  await createLocalAccount(account, storage);
  const raw = storage.getItem(LOCAL_AUTH_STORAGE_KEY);
  assert.ok(!raw.includes(account.password));
  assert.equal(listLocalAccounts(storage).length, 1);
  assert.equal(listLocalAccounts(storage)[0].username, 'admin');
});

test('duplicate local identity is rejected', async () => {
  const storage = new MemoryStorage();
  await createLocalAccount(account, storage);
  await assert.rejects(() => createLocalAccount({ ...account, username: 'another' }, storage), /already exists/);
});

test('correct password opens an expiring session and logout removes it', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, storage);
  const result = await authenticateLocalAccount('admin', account.password, storage, sessions);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(readLocalSession(sessions, storage, result.session.issuedAt + 1)?.accountId, result.account.id);
  endLocalSession(sessions);
  assert.equal(sessions.getItem(LOCAL_SESSION_STORAGE_KEY), null);
});

test('five failed attempts trigger a short local lockout', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, storage);
  let result;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    result = await authenticateLocalAccount('admin', 'incorrect-password', storage, sessions, globalThis.crypto, 1_000);
  }
  assert.deepEqual(result, { ok: false, reason: 'locked' });
  assert.deepEqual(await authenticateLocalAccount('admin', account.password, storage, sessions, globalThis.crypto, 1_001), { ok: false, reason: 'locked' });
});

test('weak passwords are refused', async () => {
  await assert.rejects(() => createLocalAccount({ ...account, password: 'weak' }, new MemoryStorage()), /12–128/);
});

test('stored session cannot elevate role through sessionStorage tampering', async () => {
  const accountStorage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, accountStorage);
  const admin = listLocalAccounts(accountStorage)[0];
  await createLocalAccount(
    { ...account, name: 'Read Only User', email: 'viewer@example.local', username: 'viewer', role: 'Viewer' },
    accountStorage, globalThis.crypto, new Date(), { id: admin.id, role: admin.role }
  );
  const result = await authenticateLocalAccount('viewer', account.password, accountStorage, sessions);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const forged = { ...result.session, role: 'Super Admin' };
  sessions.setItem(LOCAL_SESSION_STORAGE_KEY, JSON.stringify(forged));
  const restored = readLocalSession(sessions, accountStorage);
  assert.equal(restored?.role, 'Viewer');
});

test('session is discarded when its local account no longer exists', async () => {
  const accountStorage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, accountStorage);
  const result = await authenticateLocalAccount('admin', account.password, accountStorage, sessions);
  assert.equal(result.ok, true);
  accountStorage.setItem(LOCAL_AUTH_STORAGE_KEY, '[]');
  assert.equal(readLocalSession(sessions, accountStorage), null);
  assert.equal(sessions.getItem(LOCAL_SESSION_STORAGE_KEY), null);
});


test('corrupt account registry cannot be treated as first-run setup or overwritten', async () => {
  const storage = new MemoryStorage();
  storage.setItem(LOCAL_AUTH_STORAGE_KEY, '{not-json');
  assert.match(localAccountRegistryError(storage) || '', /unreadable/);
  await assert.rejects(() => createLocalAccount(account, storage), /unreadable/);
  assert.equal(storage.getItem(LOCAL_AUTH_STORAGE_KEY), '{not-json');
});

test('disabling an account blocks sign-in and revokes an existing device session', async () => {
  const accountStorage = new MemoryStorage();
  const sessions = new MemoryStorage();
  const administrator = await createLocalAccount(account, accountStorage);
  const operator = await createLocalAccount({
    name: 'Local Operator', email: 'operator@example.local', username: 'operator',
    role: 'Operator', password: 'A-different-long-passphrase-2026'
  }, accountStorage, globalThis.crypto, new Date(), { id: administrator.id, role: administrator.role });
  const signedIn = await authenticateLocalAccount('operator', 'A-different-long-passphrase-2026', accountStorage, sessions);
  assert.equal(signedIn.ok, true);
  setLocalAccountDisabled(operator.id, true, { id: administrator.id, role: 'Super Admin' }, accountStorage);
  assert.equal(readLocalSession(sessions, accountStorage), null);
  assert.deepEqual(
    await authenticateLocalAccount('operator', 'A-different-long-passphrase-2026', accountStorage, sessions),
    { ok: false, reason: 'disabled' }
  );
});

test('a Super Admin cannot demote their own account or disable their own session', async () => {
  const storage = new MemoryStorage();
  const administrator = await createLocalAccount(account, storage);
  const actor = { id: administrator.id, role: 'Super Admin' };
  assert.throws(() => updateLocalAccount(administrator.id, { role: 'Admin' }, actor, storage), /Self-promotion or self-demotion/i);
  assert.throws(() => setLocalAccountDisabled(administrator.id, true, actor, storage), /cannot disable your own active session/i);
  const secondAdmin = await createLocalAccount({
    name: 'Second Admin', email: 'second-admin@example.local', username: 'second-admin',
    role: 'Viewer', password: 'Another-long-passphrase-2026'
  }, storage, globalThis.crypto, new Date(), actor);
  updateLocalAccount(secondAdmin.id, { role: 'Super Admin' }, actor, storage);
  setLocalAccountDisabled(secondAdmin.id, true, actor, storage);
  assert.throws(() => setLocalAccountDisabled(administrator.id, true, { id: secondAdmin.id, role: 'Super Admin' }, storage), /active Super Admin session/i);
});

test('administrator password reset requires a new password on next sign-in', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  const administrator = await createLocalAccount(account, storage);
  const operator = await createLocalAccount({
    name: 'Local Operator', email: 'operator@example.local', username: 'operator',
    role: 'Operator', password: 'A-different-long-passphrase-2026'
  }, storage, globalThis.crypto, new Date(), { id: administrator.id, role: administrator.role });
  const temporaryPassword = 'Temporary-password-2026!';
  const updated = await changeLocalAccountPassword(
    operator.id, '', temporaryPassword, { id: administrator.id, role: 'Super Admin' }, storage
  );
  assert.equal(updated.mustChangePassword, true);
  assert.equal((await authenticateLocalAccount('operator', 'A-different-long-passphrase-2026', storage, sessions)).ok, false);
  const signIn = await authenticateLocalAccount('operator', temporaryPassword, storage, sessions);
  assert.equal(signIn.ok, true);
  if (!signIn.ok) return;
  assert.equal(signIn.session.mustChangePassword, true);
});

test('password change invalidates a previous session by credential version', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  const created = await createLocalAccount(account, storage);
  const signIn = await authenticateLocalAccount('admin', account.password, storage, sessions);
  assert.equal(signIn.ok, true);
  if (!signIn.ok) return;
  const updatedPassword = 'A-new-and-strong-passphrase-2026!';
  await changeLocalAccountPassword(
    created.id, account.password, updatedPassword,
    { id: created.id, role: 'Super Admin' }, storage
  );
  assert.equal(readLocalSession(sessions, storage), null);
  assert.equal((await authenticateLocalAccount('admin', updatedPassword, storage, sessions)).ok, true);
});



test('additional local accounts require an active Super Admin actor', async () => {
  const storage = new MemoryStorage();
  await createLocalAccount(account, storage);
  await assert.rejects(
    () => createLocalAccount({ ...account, email: 'viewer@example.local', username: 'viewer', role: 'Viewer' }, storage),
    /active Super Admin session/
  );
  const admin = listLocalAccounts(storage)[0];
  const viewer = await createLocalAccount(
    { ...account, name: 'Read Only', email: 'viewer@example.local', username: 'viewer', role: 'Viewer' },
    storage, globalThis.crypto, new Date(), { id: admin.id, role: admin.role }
  );
  assert.equal(viewer.role, 'Viewer');
});

test('disabled accounts cannot authenticate and existing sessions are invalidated', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, storage);
  const admin = listLocalAccounts(storage)[0];
  await createLocalAccount(
    { ...account, name: 'Operator', email: 'operator@example.local', username: 'operator', role: 'Operator' },
    storage, globalThis.crypto, new Date(), { id: admin.id, role: admin.role }
  );
  const operator = listLocalAccounts(storage).find(item => item.username === 'operator');
  assert.ok(operator);
  const login = await authenticateLocalAccount('operator', account.password, storage, sessions);
  assert.equal(login.ok, true);
  if (!login.ok) return;
  setLocalAccountDisabled(operator.id, true, { id: admin.id, role: admin.role }, storage);
  assert.equal(readLocalSession(sessions, storage), null);
  assert.deepEqual(await authenticateLocalAccount('operator', account.password, storage, sessions), { ok: false, reason: 'disabled' });
  setLocalAccountDisabled(operator.id, false, { id: admin.id, role: admin.role }, storage);
  assert.equal((await authenticateLocalAccount('operator', account.password, storage, sessions)).ok, true);
});

test('the last active Super Admin cannot be disabled or demoted', async () => {
  const storage = new MemoryStorage();
  await createLocalAccount(account, storage);
  const admin = listLocalAccounts(storage)[0];
  assert.throws(
    () => setLocalAccountDisabled(admin.id, true, { id: 'other', role: 'Super Admin' }, storage),
    /active Super Admin session/
  );
  assert.throws(
    () => updateLocalAccount(admin.id, { role: 'Admin' }, { id: admin.id, role: 'Super Admin' }, storage),
    /Self-promotion or self-demotion/
  );
  const second = await createLocalAccount(
    { ...account, name: 'Second Administrator', email: 'second@example.local', username: 'second', role: 'Admin' },
    storage, globalThis.crypto, new Date(), { id: admin.id, role: 'Super Admin' }
  );
  assert.throws(
    () => setLocalAccountDisabled(admin.id, true, { id: second.id, role: 'Admin' }, storage),
    /active Super Admin session/
  );
  assert.throws(
    () => updateLocalAccount(admin.id, { role: 'Admin' }, { id: admin.id, role: 'Super Admin' }, storage),
    /Self-promotion or self-demotion/
  );
});

test('a Super Admin cannot self-promote from a lower role', async () => {
  const storage = new MemoryStorage();
  await createLocalAccount(account, storage);
  const admin = listLocalAccounts(storage)[0];
  const operator = await createLocalAccount(
    { ...account, name: 'Operator', email: 'operator@example.local', username: 'operator', role: 'Operator' },
    storage, globalThis.crypto, new Date(), { id: admin.id, role: admin.role }
  );
  assert.throws(
    () => updateLocalAccount(operator.id, { role: 'Super Admin' }, { id: operator.id, role: 'Operator' }, storage),
    /active Super Admin session/
  );
  const promoted = updateLocalAccount(operator.id, { role: 'Super Admin' }, { id: admin.id, role: admin.role }, storage);
  assert.equal(promoted.role, 'Super Admin');
});

test('password changes verify current password and invalidate earlier sessions', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, storage);
  const before = await authenticateLocalAccount('admin', account.password, storage, sessions);
  assert.equal(before.ok, true);
  if (!before.ok) return;
  await assert.rejects(
    () => changeLocalAccountPassword(before.account.id, 'wrong-current-password', 'A-New-Secure-Password-2026!', { id: before.account.id, role: before.account.role }, storage),
    /current password is incorrect/
  );
  await changeLocalAccountPassword(before.account.id, account.password, 'A-New-Secure-Password-2026!', { id: before.account.id, role: before.account.role }, storage);
  assert.equal(readLocalSession(sessions, storage), null);
  assert.equal((await authenticateLocalAccount('admin', account.password, storage, sessions)).ok, false);
  const after = await authenticateLocalAccount('admin', 'A-New-Secure-Password-2026!', storage, sessions);
  assert.equal(after.ok, true);
  assert.equal(after.ok && after.session.mustChangePassword, false);
});

test('a Super Admin reset forces the target to change the temporary password at next sign-in', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, storage);
  const admin = listLocalAccounts(storage)[0];
  await createLocalAccount(
    { ...account, name: 'Maintenance', email: 'maintenance@example.local', username: 'maintenance', role: 'Maintenance Engineer' },
    storage, globalThis.crypto, new Date(), { id: admin.id, role: admin.role }
  );
  const user = listLocalAccounts(storage).find(item => item.username === 'maintenance');
  assert.ok(user);
  const temporary = 'A1!Temporary-Password-2026!';
  await changeLocalAccountPassword(user.id, '', temporary, { id: admin.id, role: admin.role }, storage);
  assert.equal(readLocalSession(sessions, storage), null);
  const login = await authenticateLocalAccount('maintenance', temporary, storage, sessions);
  assert.equal(login.ok, true);
  assert.equal(login.ok && login.session.mustChangePassword, true);
});
