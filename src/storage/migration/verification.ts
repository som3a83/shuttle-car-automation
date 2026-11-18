import type { MigrationStorageContext, StorageKey } from '../index';
import {
  AUDIT_GENESIS_HASH,
  verifyAuditChain,
  type AuditArchiveEntry,
  type AuditRecord
} from '../../security/auditLog';
import type { AdapterResult } from '../adapters/legacyKeyMap';

export interface KeyVerification {
  key: StorageKey;
  recordCount: number;
  expectedChecksum: string;
  actualChecksum: string;
  status: 'passed' | 'failed';
}
export interface MigrationVerificationReport {
  valid: boolean;
  checkedKeyCount: number;
  keyResults: KeyVerification[];
  auditChainValid: boolean;
  errors: string[];
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? 'null' : encoded;
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const record = value as Record<string, unknown>;
  return '{' + Object.keys(record).sort().map((key) =>
    JSON.stringify(key) + ':' + canonicalJson(record[key])
  ).join(',') + '}';
}

export async function sha256Canonical(value: unknown, cryptoApi: Crypto = globalThis.crypto): Promise<string> {
  if (!cryptoApi?.subtle) throw new Error('Web Crypto SHA-256 is unavailable; migration verification cannot continue.');
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function countMigrationRecords(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  return value === null || value === undefined ? 0 : 1;
}

async function verifyAuditStaging(
  context: MigrationStorageContext,
  cryptoApi: Crypto
): Promise<{ valid: boolean; reason?: string }> {
  const active = await context.get<AuditRecord[]>('audit.active');
  const archives = await context.get<AuditArchiveEntry[]>('audit.archives');
  if (!Array.isArray(active) || !Array.isArray(archives)) {
    return { valid: false, reason: 'Audit staging keys are missing or are not arrays.' };
  }

  let previousArchiveHash = AUDIT_GENESIS_HASH;
  let previousRecordHash = AUDIT_GENESIS_HASH;
  for (let index = 0; index < archives.length; index += 1) {
    const archive = archives[index];
    if (!archive || archive.format !== 'shuttle-audit-archive' || archive.version !== 1 ||
        !Number.isInteger(archive.recordCount) || archive.recordCount < 1 ||
        !Array.isArray(archive.records) || archive.records.length !== archive.recordCount) {
      return { valid: false, reason: `Audit archive ${index} has an invalid manifest or count.` };
    }
    if (archive.previousArchiveHash !== previousArchiveHash || archive.previousRecordHash !== previousRecordHash) {
      return { valid: false, reason: `Audit archive ${index} has a broken chain anchor.` };
    }
    if (await sha256Canonical(archive.records, cryptoApi) !== archive.recordsDigest) {
      return { valid: false, reason: `Audit archive ${index} records checksum does not match.` };
    }
    const chain = await verifyAuditChain(archive.records, cryptoApi, previousRecordHash);
    if (!chain.valid) return { valid: false, reason: chain.reason || `Audit archive ${index} record chain is invalid.` };
    const first = archive.records[0];
    const last = archive.records[archive.records.length - 1];
    if (!first || !last || first.id !== archive.firstRecordId || last.id !== archive.lastRecordId ||
        first.hash !== archive.firstRecordHash || last.hash !== archive.lastRecordHash) {
      return { valid: false, reason: `Audit archive ${index} boundary records do not match its manifest.` };
    }
    const unsigned = { ...archive } as Record<string, unknown>;
    delete unsigned.archiveHash;
    if (await sha256Canonical(unsigned, cryptoApi) !== archive.archiveHash) {
      return { valid: false, reason: `Audit archive ${index} hash does not match its manifest.` };
    }
    previousArchiveHash = archive.archiveHash;
    previousRecordHash = last.hash;
  }

  const activeChain = await verifyAuditChain(active, cryptoApi, previousRecordHash);
  return activeChain.valid
    ? { valid: true }
    : { valid: false, reason: activeChain.reason || 'The active audit chain is invalid.' };
}

/**
 * Checks every imported logical key against adapter-confirmed source values,
 * including the approved defaults for absent legacy keys.
 */
export async function verifyStagedMigration(
  context: MigrationStorageContext,
  results: readonly AdapterResult[],
  expectedKeys: readonly StorageKey[],
  cryptoApi: Crypto = globalThis.crypto
): Promise<MigrationVerificationReport> {
  const errors: string[] = [];
  const keyResults: KeyVerification[] = [];
  if (results.length !== expectedKeys.length) {
    errors.push(`Expected ${expectedKeys.length} adapter results, received ${results.length}.`);
  }

  for (let index = 0; index < expectedKeys.length; index += 1) {
    const key = expectedKeys[index];
    const result = results[index];
    if (!result || result.key !== key) {
      errors.push(`Adapter result order mismatch at index ${index}; expected ${key}.`);
      continue;
    }
    if (result.status !== 'imported' && result.status !== 'already-synced') {
      errors.push(`Legacy source for ${key} did not import cleanly (${result.status}).`);
      continue;
    }

    const staged = await context.getWithRevision(key);
    if (!staged) {
      errors.push(`Staging value is missing for ${key}.`);
      continue;
    }
    const recordCount = countMigrationRecords(staged.value);
    if (recordCount !== result.recordsCount) {
      errors.push(`Record count mismatch for ${key}: adapter=${result.recordsCount}, staging=${recordCount}.`);
      keyResults.push({
        key,
        recordCount,
        expectedChecksum: '',
        actualChecksum: await sha256Canonical(staged.value, cryptoApi),
        status: 'failed'
      });
      continue;
    }

    // "already-synced" is returned only after the adapter compared the staged
    // value with the parsed/normalized legacy source using canonical equality.
    const expectedValue = result.status === 'imported' ? result.value : staged.value;
    const expectedChecksum = await sha256Canonical(expectedValue, cryptoApi);
    const actualChecksum = await sha256Canonical(staged.value, cryptoApi);
    const matched = expectedChecksum === actualChecksum;
    if (!matched) errors.push(`SHA-256 checksum mismatch for ${key}.`);
    keyResults.push({
      key,
      recordCount,
      expectedChecksum,
      actualChecksum,
      status: matched ? 'passed' : 'failed'
    });
  }

  let auditChainValid = false;
  try {
    const audit = await verifyAuditStaging(context, cryptoApi);
    auditChainValid = audit.valid;
    if (!audit.valid) errors.push(audit.reason || 'Audit chain integrity verification failed.');
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Audit chain integrity verification failed.');
  }

  return {
    valid: errors.length === 0 && keyResults.length === expectedKeys.length && auditChainValid,
    checkedKeyCount: keyResults.length,
    keyResults,
    auditChainValid,
    errors
  };
}
