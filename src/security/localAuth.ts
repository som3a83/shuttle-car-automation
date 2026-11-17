import type { Role } from '../types';

export const LOCAL_AUTH_STORAGE_KEY = 'shuttle-car-automation-v1:local-accounts';
export const LOCAL_SESSION_STORAGE_KEY = 'shuttle-car-automation-v1:session';
export const LOCAL_AUTH_ITERATIONS = 210_000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
// 2B-3b remains on the approved legacy mode while App.tsx still has synchronous
// compatibility reads. Load storage only when an async account API is used,
// keeping native Node consumers of the synchronous compatibility API isolated.
type AsyncAuthEngine = import('../storage/index.ts').StorageEngine;
let asyncAuthEnginePromise: Promise<AsyncAuthEngine> | null = null;

async function getAsyncAuthEngine(): Promise<AsyncAuthEngine> {
  if (!asyncAuthEnginePromise) {
    asyncAuthEnginePromise = import('../storage/index.ts').then(
      ({ LegacyFallbackEngine }) => new LegacyFallbackEngine()
    );
  }
  return asyncAuthEnginePromise;
}
const ALLOWED_ROLES: readonly Role[] = ['Super Admin', 'Admin', 'Supervisor', 'Maintenance Engineer', 'Technician', 'Operator', 'Viewer'];

export interface LocalAccountInput {
  name: string;
  email: string;
  username: string;
  role: Role;
  password: string;
}

export interface LocalAccount {
  id: string;
  name: string;
  email: string;
  username: string;
  role: Role;
  createdAt: string;
  passwordSalt: string;
  passwordHash: string;
  iterations: number;
  failedAttempts: number;
  lockedUntil: number;
  disabledAt?: string | null;
  mustChangePassword?: boolean;
  credentialVersion?: number;
}

export interface LocalAccountSummary extends Omit<LocalAccount, 'passwordSalt' | 'passwordHash' | 'iterations' | 'failedAttempts' | 'lockedUntil'> {}

export interface LocalSession {
  token: string;
  accountId: string;
  name: string;
  email: string;
  role: Role;
  issuedAt: number;
  expiresAt: number;
  mustChangePassword: boolean;
  credentialVersion: number;
}

export interface AuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export type AuthResult =
  | { ok: true; account: LocalAccountSummary; session: LocalSession }
  | { ok: false; reason: 'invalid-credentials' | 'locked' | 'not-found' | 'disabled' };

export interface LocalAccountPatch {
  name?: string;
  email?: string;
  username?: string;
  role?: Role;
}

export interface LocalAccountActor {
  id: string;
  role: Role;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function normalizeUsername(value: string): string { return value.trim().toLocaleLowerCase(); }
function toSummary(account: LocalAccount): LocalAccountSummary {
  const { passwordSalt: _salt, passwordHash: _hash, iterations: _iterations,
    failedAttempts: _failures, lockedUntil: _locked, ...summary } = account;
  return summary;
}
function readAccounts(storage: AuthStorage): LocalAccount[] {
  const raw = storage.getItem(LOCAL_AUTH_STORAGE_KEY);
  if (raw === null) return [];
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error('Local account registry is unreadable. Account creation is disabled to prevent overwriting existing identities.'); }
  if (!Array.isArray(value)) throw new Error('Local account registry has an invalid format. Account creation is disabled.');
  const valid = value.every((item) => Boolean(item && typeof item === 'object' &&
    typeof item.id === 'string' && item.id.length > 0 && typeof item.name === 'string' && item.name.trim() &&
    typeof item.email === 'string' && typeof item.username === 'string' &&
    typeof item.passwordSalt === 'string' && typeof item.passwordHash === 'string' &&
    /^[A-Za-z0-9+/]{22}==$/.test(item.passwordSalt) && /^[A-Za-z0-9+/]{43}=$/.test(item.passwordHash) &&
    ALLOWED_ROLES.includes(item.role) && item.iterations === LOCAL_AUTH_ITERATIONS &&
    Number.isInteger(item.failedAttempts) && item.failedAttempts >= 0 && Number.isFinite(item.lockedUntil) &&
    (item.disabledAt === undefined || item.disabledAt === null || (typeof item.disabledAt === 'string' && Number.isFinite(Date.parse(item.disabledAt)))) &&
    (item.mustChangePassword === undefined || typeof item.mustChangePassword === 'boolean') &&
    (item.credentialVersion === undefined || (Number.isInteger(item.credentialVersion) && item.credentialVersion >= 1)) &&
    typeof item.createdAt === 'string'));
  if (!valid) throw new Error('Local account registry contains invalid records. Account creation is disabled pending recovery.');
  const accounts = value as LocalAccount[];
  if (new Set(accounts.map((item) => item.id)).size !== accounts.length ||
      new Set(accounts.map((item) => item.username)).size !== accounts.length ||
      new Set(accounts.map((item) => item.email)).size !== accounts.length) {
    throw new Error('Local account registry contains duplicate identities. Account creation is disabled pending recovery.');
  }
  return accounts;
}
async function derive(password: string, salt: Uint8Array, cryptoApi: Crypto, iterations = LOCAL_AUTH_ITERATIONS): Promise<Uint8Array> {
  const key = await cryptoApi.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const bits = await cryptoApi.subtle.deriveBits({ name: 'PBKDF2', salt: saltBuffer, iterations, hash: 'SHA-256' }, key, 256);
  return new Uint8Array(bits);
}
function randomId(cryptoApi: Crypto): string {
  return cryptoApi.randomUUID?.() || bytesToBase64(cryptoApi.getRandomValues(new Uint8Array(18))).replace(/[+/=]/g, '');
}

export function listLocalAccounts(storage: AuthStorage = localStorage): LocalAccountSummary[] {
  try { return readAccounts(storage).map(toSummary); }
  catch { return []; }
}

export function localAccountRegistryError(storage: AuthStorage = localStorage): string | null {
  try { readAccounts(storage); return null; }
  catch (reason) { return reason instanceof Error ? reason.message : 'Local account registry is unavailable.'; }
}

export async function createLocalAccount(
  input: LocalAccountInput,
  storage: AuthStorage = localStorage,
  cryptoApi: Crypto = globalThis.crypto,
  now = new Date(),
  actor?: LocalAccountActor
): Promise<LocalAccountSummary> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const username = normalizeUsername(input.username);
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('Enter a name, valid email and username (3–32 letters, numbers, dots, dashes or underscores).');
  }
  if (!ALLOWED_ROLES.includes(input.role)) throw new Error('The selected role is not supported.');
  if (input.password.length < 12 || input.password.length > 128) throw new Error('Password must contain 12–128 characters.');
  const existingAccounts = readAccounts(storage);
  if (existingAccounts.some((account) => account.username === username || account.email === email)) {
    throw new Error('A local account with this username or email already exists.');
  }
  if (existingAccounts.length === 0 && input.role !== 'Super Admin') {
    throw new Error('The first local account must be the initial Super Admin.');
  }
  if (existingAccounts.length > 0) {
    const actorAccount = actor ? existingAccounts.find(account => account.id === actor.id) : undefined;
    if (!actor || !actorAccount || actorAccount.disabledAt || actorAccount.role !== 'Super Admin' || actor.role !== actorAccount.role) {
      throw new Error('An active Super Admin session is required to create additional local accounts.');
    }
    if (input.role === 'Super Admin') throw new Error('Create the account with a lower role, then have an existing Super Admin review and promote another account.');
  }
  if (!cryptoApi?.subtle) throw new Error('Secure Web Crypto is unavailable. Use HTTPS or a secure local context.');
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const passwordHash = await derive(input.password, salt, cryptoApi);
  const account: LocalAccount = {
    id: `LOCAL-${randomId(cryptoApi)}`, name, email, username, role: input.role,
    createdAt: now.toISOString(), passwordSalt: bytesToBase64(salt), passwordHash: bytesToBase64(passwordHash),
    iterations: LOCAL_AUTH_ITERATIONS, failedAttempts: 0, lockedUntil: 0,
    disabledAt: null, mustChangePassword: false, credentialVersion: 1
  };
  storage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify([...readAccounts(storage), account]));
  return toSummary(account);
}

export async function authenticateLocalAccount(
  usernameOrEmail: string,
  password: string,
  storage: AuthStorage = localStorage,
  sessionStorage: AuthStorage = globalThis.sessionStorage,
  cryptoApi: Crypto = globalThis.crypto,
  now = Date.now()
): Promise<AuthResult> {
  const normalized = usernameOrEmail.trim().toLowerCase();
  const accounts = readAccounts(storage);
  const index = accounts.findIndex((account) => account.username === normalized || account.email === normalized);
  if (index < 0) return { ok: false, reason: 'not-found' };
  const account = accounts[index];
  if (account.disabledAt) return { ok: false, reason: 'disabled' };
  if (account.lockedUntil > now) return { ok: false, reason: 'locked' };
  const expected = base64ToBytes(account.passwordHash);
  const actual = await derive(password, base64ToBytes(account.passwordSalt), cryptoApi, account.iterations);
  const matched = expected.length === actual.length && expected.reduce((difference, byte, position) => difference | (byte ^ actual[position]), 0) === 0;
  if (!matched) {
    account.failedAttempts += 1;
    if (account.failedAttempts >= 5) {
      account.failedAttempts = 0;
      account.lockedUntil = now + 60_000;
    }
    storage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(accounts));
    return { ok: false, reason: account.lockedUntil > now ? 'locked' : 'invalid-credentials' };
  }
  account.failedAttempts = 0;
  account.lockedUntil = 0;
  storage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(accounts));
  const session: LocalSession = {
    token: randomId(cryptoApi), accountId: account.id, name: account.name, email: account.email, role: account.role,
    issuedAt: now, expiresAt: now + SESSION_TTL_MS,
    mustChangePassword: Boolean(account.mustChangePassword), credentialVersion: account.credentialVersion ?? 1
  };
  sessionStorage.setItem(LOCAL_SESSION_STORAGE_KEY, JSON.stringify(session));
  return { ok: true, account: toSummary(account), session };
}

export function readLocalSession(
  storage: AuthStorage = globalThis.sessionStorage,
  accountStorage: AuthStorage = globalThis.localStorage,
  now = Date.now()
): LocalSession | null {
  const clear = () => { storage.removeItem?.(LOCAL_SESSION_STORAGE_KEY); return null; };
  try {
    const session = JSON.parse(storage.getItem(LOCAL_SESSION_STORAGE_KEY) || 'null') as LocalSession | null;
    if (!session || typeof session.token !== 'string' || session.token.length < 16 ||
      typeof session.accountId !== 'string' || !Number.isFinite(session.issuedAt) ||
      !Number.isFinite(session.expiresAt) || session.issuedAt > now + 60_000 ||
      session.expiresAt <= now || session.expiresAt - session.issuedAt > SESSION_TTL_MS ||
      !Number.isInteger(session.credentialVersion) || session.credentialVersion < 1) return clear();
    // Never trust the role or identity copied into sessionStorage. Resolve them
    // from the corresponding account record on every application startup.
    const account = readAccounts(accountStorage).find((candidate) => candidate.id === session.accountId);
    if (!account || account.disabledAt || (account.credentialVersion ?? 1) !== session.credentialVersion) return clear();
    return {
      token: session.token, accountId: account.id, name: account.name, email: account.email,
      role: account.role, issuedAt: session.issuedAt, expiresAt: session.expiresAt,
      mustChangePassword: Boolean(account.mustChangePassword),
      credentialVersion: account.credentialVersion ?? 1
    };
  } catch {
    return clear();
  }
}

export function updateLocalAccount(
  accountId: string,
  patch: LocalAccountPatch,
  actor: LocalAccountActor,
  storage: AuthStorage = localStorage
): LocalAccountSummary {
  const accounts = readAccounts(storage);
  const actorAccount = accounts.find(account => account.id === actor.id);
  if (!actorAccount || actorAccount.disabledAt || actorAccount.role !== 'Super Admin' || actor.role !== actorAccount.role) {
    throw new Error('An active Super Admin session is required to edit local accounts.');
  }
  const index = accounts.findIndex(account => account.id === accountId);
  if (index < 0) throw new Error('Local account was not found.');
  const current = accounts[index];
  if (actor.id === accountId && patch.role && patch.role !== current.role) {
    throw new Error('Self-promotion or self-demotion is not permitted. Another Super Admin must change this role.');
  }
  const name = patch.name === undefined ? current.name : patch.name.trim();
  const email = patch.email === undefined ? current.email : patch.email.trim().toLowerCase();
  const username = patch.username === undefined ? current.username : normalizeUsername(patch.username);
  const role = patch.role === undefined ? current.role : patch.role;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('Enter a valid name, email and username.');
  }
  if (!ALLOWED_ROLES.includes(role)) throw new Error('The selected role is not supported.');
  if (accounts.some((item, itemIndex) => itemIndex !== index &&
      (item.username === username || item.email === email))) {
    throw new Error('Another local account already uses this username or email.');
  }
  if (current.role === 'Super Admin' && role !== 'Super Admin' && !current.disabledAt) {
    const activeAdmins = accounts.filter(item => item.role === 'Super Admin' && !item.disabledAt).length;
    if (activeAdmins <= 1) throw new Error('The last active Super Admin cannot be demoted.');
  }
  const updated: LocalAccount = { ...current, name, email, username, role };
  accounts[index] = updated;
  storage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(accounts));
  return toSummary(updated);
}

export function setLocalAccountDisabled(
  accountId: string,
  disabled: boolean,
  actor: LocalAccountActor,
  storage: AuthStorage = localStorage,
  now = new Date()
): LocalAccountSummary {
  const accounts = readAccounts(storage);
  const actorAccount = accounts.find(account => account.id === actor.id);
  if (!actorAccount || actorAccount.disabledAt || actorAccount.role !== 'Super Admin' || actor.role !== actorAccount.role) {
    throw new Error('An active Super Admin session is required to disable or reactivate accounts.');
  }
  if (actor.id === accountId) throw new Error('You cannot disable or reactivate your own active session.');
  const index = accounts.findIndex(account => account.id === accountId);
  if (index < 0) throw new Error('Local account was not found.');
  const current = accounts[index];
  if (disabled && current.role === 'Super Admin' && !current.disabledAt) {
    const activeAdmins = accounts.filter(item => item.role === 'Super Admin' && !item.disabledAt).length;
    if (activeAdmins <= 1) throw new Error('The last active Super Admin cannot be disabled.');
  }
  const updated: LocalAccount = {
    ...current,
    disabledAt: disabled ? now.toISOString() : null,
    credentialVersion: (current.credentialVersion ?? 1) + 1,
    failedAttempts: 0,
    lockedUntil: 0
  };
  accounts[index] = updated;
  storage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(accounts));
  return toSummary(updated);
}

async function verifyPassword(account: LocalAccount, password: string, cryptoApi: Crypto): Promise<boolean> {
  const expected = base64ToBytes(account.passwordHash);
  const actual = await derive(password, base64ToBytes(account.passwordSalt), cryptoApi, account.iterations);
  return expected.length === actual.length &&
    expected.reduce((difference, byte, position) => difference | (byte ^ actual[position]), 0) === 0;
}

export async function changeLocalAccountPassword(
  accountId: string,
  currentPassword: string,
  newPassword: string,
  actor: LocalAccountActor,
  storage: AuthStorage = localStorage,
  cryptoApi: Crypto = globalThis.crypto,
  now = new Date()
): Promise<LocalAccountSummary> {
  const accounts = readAccounts(storage);
  const index = accounts.findIndex(account => account.id === accountId);
  if (index < 0) throw new Error('Local account was not found.');
  const current = accounts[index];
  const selfChange = actor.id === accountId;
  const actorAccount = accounts.find(account => account.id === actor.id);
  if (!actorAccount || actorAccount.disabledAt || actorAccount.role !== actor.role ||
      (!selfChange && actorAccount.role !== 'Super Admin')) {
    throw new Error('An active matching local identity is required to change or reset this password.');
  }
  if (selfChange && !await verifyPassword(current, currentPassword, cryptoApi)) {
    throw new Error('The current password is incorrect.');
  }
  if (newPassword.length < 12 || newPassword.length > 128) throw new Error('Password must contain 12–128 characters.');
  if (!cryptoApi?.subtle) throw new Error('Secure Web Crypto is unavailable. Use HTTPS or a secure local context.');
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const hash = await derive(newPassword, salt, cryptoApi);
  const updated: LocalAccount = {
    ...current,
    passwordSalt: bytesToBase64(salt),
    passwordHash: bytesToBase64(hash),
    iterations: LOCAL_AUTH_ITERATIONS,
    failedAttempts: 0,
    lockedUntil: 0,
    mustChangePassword: !selfChange,
    credentialVersion: (current.credentialVersion ?? 1) + 1
  };
  accounts[index] = updated;
  storage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(accounts));
  return toSummary(updated);
}

class MemoryAuthStorage implements AuthStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
  removeItem(key: string): void { this.values.delete(key); }
}

function isRevisionConflict(reason: unknown): boolean {
  return Boolean(reason && typeof reason === 'object' &&
    'code' in reason && (reason as { code?: unknown }).code === 'STORAGE_CONFLICT');
}

async function withAsyncAccountStorage<T>(
  operation: (storage: AuthStorage) => T | Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const engine = await getAsyncAuthEngine();
    const current = await engine.read('auth.accounts');
    const storage = new MemoryAuthStorage();
    if (current) storage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(current.value));
    const before = storage.getItem(LOCAL_AUTH_STORAGE_KEY);
    const result = await operation(storage);
    const after = storage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (after === before) return result;

    let accounts: unknown;
    try { accounts = JSON.parse(after ?? 'null'); }
    catch { throw new Error('Local account registry could not be serialized safely.'); }

    try {
      await engine.write('auth.accounts', accounts, current?.revision ?? 0);
      return result;
    } catch (reason) {
      if (!isRevisionConflict(reason)) throw reason;
      if (attempt === 2) throw new Error('LOCAL_ACCOUNT_UPDATE_FAILED_AFTER_RETRIES');
    }
  }
  throw new Error('LOCAL_ACCOUNT_UPDATE_FAILED_AFTER_RETRIES');
}

/** Async account read used by the backend APIs. Password material stays internal. */
async function readAccountsAsync(): Promise<LocalAccount[]> {
  const engine = await getAsyncAuthEngine();
  const current = await engine.read('auth.accounts');
  if (!current) return [];
  const storage = new MemoryAuthStorage();
  storage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(current.value));
  return readAccounts(storage);
}

/** Async counterpart to the synchronous session resolver. */
export async function readLocalSessionAsync(
  sessionStorage: AuthStorage = globalThis.sessionStorage,
  now = Date.now()
): Promise<LocalSession | null> {
  const accounts = await readAccountsAsync();
  const accountStorage = new MemoryAuthStorage();
  accountStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(accounts));
  return readLocalSession(sessionStorage, accountStorage, now);
}

/** Async account read for components moving to the backend storage layer. */

export async function listLocalAccountsAsync(): Promise<LocalAccountSummary[]> {
  return (await readAccountsAsync()).map(toSummary);
}

export async function localAccountRegistryErrorAsync(): Promise<string | null> {
  try { await listLocalAccountsAsync(); return null; }
  catch (reason) {
    return reason instanceof Error ? reason.message : 'Local account registry is unavailable.';
  }
}

export async function createLocalAccountAsync(
  input: LocalAccountInput,
  cryptoApi: Crypto = globalThis.crypto,
  now = new Date(),
  actor?: LocalAccountActor
): Promise<LocalAccountSummary> {
  return withAsyncAccountStorage((storage) => createLocalAccount(input, storage, cryptoApi, now, actor));
}

export async function authenticateLocalAccountAsync(
  usernameOrEmail: string,
  password: string,
  sessionStorage: AuthStorage = globalThis.sessionStorage,
  cryptoApi: Crypto = globalThis.crypto,
  now = Date.now()
): Promise<AuthResult> {
  const pendingSession = new MemoryAuthStorage();
  const result = await withAsyncAccountStorage((storage) =>
    authenticateLocalAccount(usernameOrEmail, password, storage, pendingSession, cryptoApi, now)
  );

  if (result.ok) {
    const sessionRaw = pendingSession.getItem(LOCAL_SESSION_STORAGE_KEY);
    if (!sessionRaw) throw new Error('Local sign-in completed without creating a session record.');
    sessionStorage.setItem(LOCAL_SESSION_STORAGE_KEY, sessionRaw);
  }
  return result;
}

export async function updateLocalAccountAsync(
  accountId: string,
  patch: LocalAccountPatch,
  actor: LocalAccountActor
): Promise<LocalAccountSummary> {
  return withAsyncAccountStorage((storage) => updateLocalAccount(accountId, patch, actor, storage));
}

export async function setLocalAccountDisabledAsync(
  accountId: string,
  disabled: boolean,
  actor: LocalAccountActor,
  now = new Date()
): Promise<LocalAccountSummary> {
  return withAsyncAccountStorage((storage) => setLocalAccountDisabled(accountId, disabled, actor, storage, now));
}

export async function changeLocalAccountPasswordAsync(
  accountId: string,
  currentPassword: string,
  newPassword: string,
  actor: LocalAccountActor,
  cryptoApi: Crypto = globalThis.crypto,
  now = new Date()
): Promise<LocalAccountSummary> {
  return withAsyncAccountStorage((storage) =>
    changeLocalAccountPassword(accountId, currentPassword, newPassword, actor, storage, cryptoApi, now)
  );
}

/** Stable async API names for callers that do not need the legacy naming. */
export const createAccountAsync = createLocalAccountAsync;
export const updateAccountAsync = updateLocalAccountAsync;
export const changePasswordAsync = changeLocalAccountPasswordAsync;

export function generateTemporaryPassword(cryptoApi: Crypto = globalThis.crypto): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const random = cryptoApi.getRandomValues(new Uint8Array(24));
  const body = Array.from(random, value => alphabet[value % alphabet.length]).join('');
  return `A1!${body}z`;
}

export function endLocalSession(storage: AuthStorage = globalThis.sessionStorage): void {
  storage.removeItem?.(LOCAL_SESSION_STORAGE_KEY);
}

/**
 * Device-local authentication only. It is not a substitute for a server-side
 * identity provider, centralized account revocation, or server authorization.
 */
export const LOCAL_AUTH_SECURITY_NOTE =
  'Credentials are hashed with PBKDF2-SHA-256 and sessions are browser-session scoped. This is a single-device local control, not enterprise identity or remote RBAC.';
