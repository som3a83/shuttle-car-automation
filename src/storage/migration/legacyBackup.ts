export interface LegacyStorageBackupRecord {
  key: string;
  value: string;
}

export interface LegacyStorageBackup {
  format: 'shuttle-legacy-storage-backup';
  schemaVersion: 1;
  exportedAt: string;
  source: 'window.localStorage';
  recordCount: number;
  records: LegacyStorageBackupRecord[];
  sha256: string;
}

/**
 * Captures every localStorage key/value pair without parsing or rewriting values.
 * This is a migration safety copy, not the application export format. The SHA-256
 * digest covers the canonical payload excluding the digest field itself.
 */
export async function createLegacyStorageBackup(
  storage: Pick<Storage, 'length' | 'key' | 'getItem'> = globalThis.localStorage,
  cryptoApi: Crypto = globalThis.crypto,
  now = new Date()
): Promise<LegacyStorageBackup> {
  if (!storage || typeof storage.length !== 'number' ||
      typeof storage.key !== 'function' || typeof storage.getItem !== 'function') {
    throw new Error('Browser local storage is not available for a complete pre-migration backup.');
  }
  if (!cryptoApi?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('Web Crypto SHA-256 is unavailable. A verified migration backup cannot be created.');
  }

  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keys.push(key);
  }
  keys.sort((left, right) => left.localeCompare(right));

  const records: LegacyStorageBackupRecord[] = [];
  for (const key of keys) {
    const value = storage.getItem(key);
    if (value === null) {
      throw new Error(`Local storage changed while creating the backup (key: ${key}). Retry before migrating.`);
    }
    records.push({ key, value });
  }

  // Recheck key membership and values so a concurrent tab cannot silently produce
  // a backup assembled from two different points in time.
  const keysAfter: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key !== null) keysAfter.push(key);
  }
  keysAfter.sort((left, right) => left.localeCompare(right));
  if (keysAfter.length !== keys.length || keysAfter.some((key, index) => key !== keys[index])) {
    throw new Error('Local storage changed while creating the backup. Retry before migrating.');
  }
  for (const record of records) {
    if (storage.getItem(record.key) !== record.value) {
      throw new Error(`Local storage changed while creating the backup (key: ${record.key}). Retry before migrating.`);
    }
  }

  const payload = {
    format: 'shuttle-legacy-storage-backup' as const,
    schemaVersion: 1 as const,
    exportedAt: now.toISOString(),
    source: 'window.localStorage' as const,
    recordCount: records.length,
    records
  };
  const digest = await cryptoApi.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');

  return { ...payload, sha256 };
}
