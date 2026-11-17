import type { Role } from '../types';

export const LOCAL_AUTH_STORAGE_KEY = 'shuttle-car-automation-v1:local-accounts';
export const LOCAL_SESSION_STORAGE_KEY = 'shuttle-car-automation-v1:session';
export const LOCAL_AUTH_ITERATIONS = 210_000;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
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
}

export interface AuthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export type AuthResult =
  | { ok: true; account: LocalAccountSummary; session: LocalSession }
  | { ok: false; reason: 'invalid-credentials' | 'locked' | 'not-found' };

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
  const bits = await cryptoApi.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
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
  now = new Date()
): Promise<LocalAccountSummary> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const username = normalizeUsername(input.username);
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new Error('Enter a name, valid email and username (3–32 letters, numbers, dots, dashes or underscores).');
  }
  if (!ALLOWED_ROLES.includes(input.role)) throw new Error('The selected role is not supported.');
  if (input.password.length < 12 || input.password.length > 128) throw new Error('Password must contain 12–128 characters.');
  if (readAccounts(storage).some((account) => account.username === username || account.email === email)) {
    throw new Error('A local account with this username or email already exists.');
  }
  if (!cryptoApi?.subtle) throw new Error('Secure Web Crypto is unavailable. Use HTTPS or a secure local context.');
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const passwordHash = await derive(input.password, salt, cryptoApi);
  const account: LocalAccount = {
    id: `LOCAL-${randomId(cryptoApi)}`, name, email, username, role: input.role,
    createdAt: now.toISOString(), passwordSalt: bytesToBase64(salt), passwordHash: bytesToBase64(passwordHash),
    iterations: LOCAL_AUTH_ITERATIONS, failedAttempts: 0, lockedUntil: 0
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
    issuedAt: now, expiresAt: now + SESSION_TTL_MS
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
      session.expiresAt <= now || session.expiresAt - session.issuedAt > SESSION_TTL_MS) return clear();
    // Never trust the role or identity copied into sessionStorage. Resolve them
    // from the corresponding account record on every application startup.
    const account = readAccounts(accountStorage).find((candidate) => candidate.id === session.accountId);
    if (!account) return clear();
    return {
      token: session.token, accountId: account.id, name: account.name, email: account.email,
      role: account.role, issuedAt: session.issuedAt, expiresAt: session.expiresAt
    };
  } catch {
    return clear();
  }
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
