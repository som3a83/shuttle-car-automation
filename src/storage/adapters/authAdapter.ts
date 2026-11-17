import { importMappedLegacyKey, AUTH_LEGACY_KEY_MAP, type AdapterResult, type LegacyReadStorage } from './legacyKeyMap';
import type { Role } from '../../types';
import type { LocalAccount } from '../../security/localAuth';

const ALLOWED_ROLES: readonly Role[] = [
  'Super Admin', 'Admin', 'Supervisor', 'Maintenance Engineer', 'Technician', 'Operator', 'Viewer'
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isLocalAccount(value: unknown): value is LocalAccount {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0 &&
    typeof value.name === 'string' && value.name.trim().length > 0 &&
    typeof value.email === 'string' && typeof value.username === 'string' &&
    typeof value.passwordSalt === 'string' && /^[A-Za-z0-9+/]{22}==$/.test(value.passwordSalt) &&
    typeof value.passwordHash === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(value.passwordHash) &&
    ALLOWED_ROLES.includes(value.role as Role) &&
    value.iterations === 210_000 &&
    Number.isInteger(value.failedAttempts) && Number(value.failedAttempts) >= 0 &&
    typeof value.lockedUntil === 'number' && Number.isFinite(value.lockedUntil) &&
    (value.disabledAt === undefined || value.disabledAt === null ||
      (typeof value.disabledAt === 'string' && Number.isFinite(Date.parse(value.disabledAt)))) &&
    (value.mustChangePassword === undefined || typeof value.mustChangePassword === 'boolean') &&
    (value.credentialVersion === undefined ||
      (Number.isInteger(value.credentialVersion) && Number(value.credentialVersion) >= 1)) &&
    typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt));
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
