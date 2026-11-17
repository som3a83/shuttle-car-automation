import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticateLocalAccount,
  changeLocalAccountPassword,
  createLocalAccount,
  endLocalSession,
  listLocalAccounts,
  localAccountRegistryError,
  readLocalSession,
  setLocalAccountDisabled,
  updateLocalAccount,
  LOCAL_AUTH_STORAGE_KEY,
  LOCAL_SESSION_STORAGE_KEY
} from './localAuth.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const account = {
  name: 'Local Administrator',
  email: 'admin@example.local',
  username: 'admin',
  role: 'Super Admin',
  password: 'A-very-long-local-passphrase-2026'
};

async function createViewer(storage) {
  const admin = listLocalAccounts(storage)[0];
  return createLocalAccount({
    name: 'Read Only User',
    email: 'viewer@example.local',
    username: 'viewer',
    role: 'Viewer',
    password: 'A-different-long-passphrase-2026'
  }, storage, globalThis.crypto, new Date(), { id: admin.id, role: admin.role });
}

test('local account stores a derived password hash, never the plaintext password', async () => {
  const storage = new MemoryStorage();
  await createLocalAccount(account, storage);
  const raw = storage.getItem(LOCAL_AUTH_STORAGE_KEY);
  assert.ok(!raw.includes(account.password));
  assert.equal(listLocalAccounts(storage).length, 1);
  assert.equal(listLocalAccounts(storage)[0].username, 'admin');
});

test('the first local identity must be the initial Super Admin', async () => {
  await assert.rejects(
    () => createLocalAccount({ ...account, role: 'Viewer' }, new MemoryStorage()),
    /first local account must be the initial Super Admin/
  );
});

test('duplicate local identity is rejected', async () => {
  const storage = new MemoryStorage();
  await createLocalAccount(account, storage);
  await assert.rejects(() => createLocalAccount({ ...account, username: 'another' }, storage), /already exists/);
});

test('additional local accounts require a valid active Super Admin identity', async () => {
  const storage = new MemoryStorage();
  await createLocalAccount(account, storage);
  await assert.rejects(
    () => createLocalAccount({ ...account, email: 'viewer@example.local', username: 'viewer', role: 'Viewer' }, storage),
    /active Super Admin session/
  );
  const viewer = await createViewer(storage);
  assert.equal(viewer.role, 'Viewer');
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
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, storage);
  await createViewer(storage);
  const result = await authenticateLocalAccount('viewer', 'A-different-long-passphrase-2026', storage, sessions);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  sessions.setItem(LOCAL_SESSION_STORAGE_KEY, JSON.stringify({ ...result.session, role: 'Super Admin' }));
  assert.equal(readLocalSession(sessions, storage)?.role, 'Viewer');
});

test('session is discarded when its local account no longer exists', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, storage);
  const result = await authenticateLocalAccount('admin', account.password, storage, sessions);
  assert.equal(result.ok, true);
  storage.setItem(LOCAL_AUTH_STORAGE_KEY, '[]');
  assert.equal(readLocalSession(sessions, storage), null);
  assert.equal(sessions.getItem(LOCAL_SESSION_STORAGE_KEY), null);
});

test('corrupt account registry cannot be treated as first-run setup or overwritten', async () => {
  const storage = new MemoryStorage();
  storage.setItem(LOCAL_AUTH_STORAGE_KEY, '{not-json');
  assert.match(localAccountRegistryError(storage) || '', /unreadable/);
  await assert.rejects(() => createLocalAccount(account, storage), /unreadable/);
  assert.equal(storage.getItem(LOCAL_AUTH_STORAGE_KEY), '{not-json');
});

test('disabling an account blocks sign-in and revokes its existing device session', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, storage);
  const admin = listLocalAccounts(storage)[0];
  const operator = await createLocalAccount({
    name: 'Local Operator',
    email: 'operator@example.local',
    username: 'operator',
    role: 'Operator',
    password: 'A-different-long-passphrase-2026'
  }, storage, globalThis.crypto, new Date(), { id: admin.id, role: admin.role });
  const login = await authenticateLocalAccount('operator', 'A-different-long-passphrase-2026', storage, sessions);
  assert.equal(login.ok, true);
  setLocalAccountDisabled(operator.id, true, { id: admin.id, role: admin.role }, storage);
  assert.equal(readLocalSession(sessions, storage), null);
  assert.deepEqual(
    await authenticateLocalAccount('operator', 'A-different-long-passphrase-2026', storage, sessions),
    { ok: false, reason: 'disabled' }
  );
  setLocalAccountDisabled(operator.id, false, { id: admin.id, role: admin.role }, storage);
  assert.equal((await authenticateLocalAccount('operator', 'A-different-long-passphrase-2026', storage, sessions)).ok, true);
});

test('self-disable and self-demotion of the only Super Admin are rejected', async () => {
  const storage = new MemoryStorage();
  const administrator = await createLocalAccount(account, storage);
  const actor = { id: administrator.id, role: 'Super Admin' };
  assert.throws(
    () => setLocalAccountDisabled(administrator.id, true, actor, storage),
    /cannot disable or reactivate your own active session/
  );
  assert.throws(
    () => updateLocalAccount(administrator.id, { role: 'Admin' }, actor, storage),
    /Self-promotion or self-demotion/
  );
  assert.equal(listLocalAccounts(storage)[0].role, 'Super Admin');
});

test('a Super Admin can edit another identity but cannot self-promote through the account editor', async () => {
  const storage = new MemoryStorage();
  await createLocalAccount(account, storage);
  const admin = listLocalAccounts(storage)[0];
  const viewer = await createViewer(storage);
  const edited = updateLocalAccount(viewer.id, {
    name: 'Updated Viewer',
    email: 'updated-viewer@example.local',
    username: 'viewer.updated'
  }, { id: admin.id, role: admin.role }, storage);
  assert.equal(edited.name, 'Updated Viewer');
  assert.equal(edited.email, 'updated-viewer@example.local');
  assert.throws(
    () => updateLocalAccount(admin.id, { role: 'Admin' }, { id: admin.id, role: admin.role }, storage),
    /Self-promotion or self-demotion/
  );
});

test('password changes require the current password and invalidate previous sessions', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  const administrator = await createLocalAccount(account, storage);
  const signIn = await authenticateLocalAccount('admin', account.password, storage, sessions);
  assert.equal(signIn.ok, true);
  if (!signIn.ok) return;
  const updatedPassword = 'A-new-and-strong-passphrase-2026!';
  await assert.rejects(
    () => changeLocalAccountPassword(administrator.id, 'wrong-password', updatedPassword, { id: administrator.id, role: 'Super Admin' }, storage),
    /current password is incorrect/
  );
  await changeLocalAccountPassword(administrator.id, account.password, updatedPassword, { id: administrator.id, role: 'Super Admin' }, storage);
  assert.equal(readLocalSession(sessions, storage), null);
  assert.equal((await authenticateLocalAccount('admin', account.password, storage, sessions)).ok, false);
  const second = await authenticateLocalAccount('admin', updatedPassword, storage, sessions);
  assert.equal(second.ok, true);
  assert.equal(second.ok && second.session.mustChangePassword, false);
});

test('a Super Admin reset forces the target to change the temporary password at next sign-in', async () => {
  const storage = new MemoryStorage();
  const sessions = new MemoryStorage();
  await createLocalAccount(account, storage);
  const admin = listLocalAccounts(storage)[0];
  const user = await createLocalAccount({
    name: 'Maintenance',
    email: 'maintenance@example.local',
    username: 'maintenance',
    role: 'Maintenance Engineer',
    password: 'A-different-long-passphrase-2026'
  }, storage, globalThis.crypto, new Date(), { id: admin.id, role: admin.role });
  const temporary = 'A1!Temporary-Password-2026!';
  const updated = await changeLocalAccountPassword(user.id, '', temporary, { id: admin.id, role: admin.role }, storage);
  assert.equal(updated.mustChangePassword, true);
  const login = await authenticateLocalAccount('maintenance', temporary, storage, sessions);
  assert.equal(login.ok, true);
  assert.equal(login.ok && login.session.mustChangePassword, true);
});


