import { importMappedLegacyKey, AUTH_LEGACY_KEY_MAP, type AdapterResult, type LegacyReadStorage } from './legacyKeyMap';
import type { Role } from '../../types';
import { LOCAL_AUTH_ITERATIONS, type LocalAccount } from '../../security/localAuth';

// Record<Role, true> makes additions/removals in the Role union a compile-time
// obligation here; Object.keys supplies the matching runtime allow-list.
const ALLOWED_ROLE_SET: Record<Role, true> = {
  'Super Admin': true,
  Admin: true,
  Supervisor: true,
  'Maintenance Engineer': true,
  Technician: true,
  Operator: true,
  Viewer: true
};
const ALLOWED_ROLES = Object.keys(ALLOWED_ROLE_SET) as Role[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isLocalAccount(value: unknown): value is LocalAccount {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' && Boolean(value.name.trim()) &&
    typeof value.email === 'string' && typeof value.username === 'string' &&
    typeof value.passwordSalt === 'string' && /^[A-Za-z0-9+/]{22}==$/.test(value.passwordSalt) &&
    typeof value.passwordHash === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(value.passwordHash) &&
    ALLOWED_ROLES.includes(value.role as Role) &&
    value.iterations === LOCAL_AUTH_ITERATIONS &&
    Number.isInteger(value.failedAttempts) && Number(value.failedAttempts) >= 0 &&
    Number.isFinite(value.lockedUntil) &&
    (value.disabledAt === undefined || value.disabledAt === null ||
      (typeof value.disabledAt === 'string' && Number.isFinite(Date.parse(value.disabledAt)))) &&
    (value.mustChangePassword === undefined || typeof value.mustChangePassword === 'boolean') &&
    (value.credentialVersion === undefined ||
      (Number.isInteger(value.credentialVersion) && Number(value.credentialVersion) >= 1)) &&
    typeof value.createdAt === 'string';
}

function isLocalAccountRegistry(value: unknown): value is LocalAccount[] {
  if (!Array.isArray(value) || !value.every(isLocalAccount)) return false;
  const accounts = value as LocalAccount[];
  return new Set(accounts.map((account) => account.id)).size === accounts.length &&
    new Set(accounts.map((account) => account.username)).size === accounts.length &&
    new Set(accounts.map((account) => account.email)).size === accounts.length;
}

/**
 * Imports persistent account records only. The sessionStorage session key is
 * deliberately not in the allow-list and is never read by this adapter.
 */
export function importAuthData(
  legacyStorage: LegacyReadStorage = globalThis.localStorage
): Promise<AdapterResult<LocalAccount[]>> {
  return importMappedLegacyKey(
    AUTH_LEGACY_KEY_MAP.accounts.legacyKey,
    isLocalAccountRegistry,
    legacyStorage,
    undefined,
    'auth'
  );
}
