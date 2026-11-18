import {
  AUDIT_LEGACY_KEY_MAP,
  AUDIT_ARCHIVE_PENDING_LEGACY_KEY,
  importDefaultForMissing,
  importMappedLegacyKey,
  readAuditArchivePendingMarker,
  type AdapterResult,
  type LegacyReadStorage
} from './legacyKeyMap';
import type { MigrationStorageContext } from '../index';
import type { AuditArchiveEntry, AuditRecord } from '../../security/auditLog';
import { verifyAuditChain, AUDIT_GENESIS_HASH } from '../../security/auditLog';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function isAuditRecord(value: unknown): value is AuditRecord {
  return isRecord(value) &&
    ['id', 'timestamp', 'actorId', 'actorRole', 'action', 'entityType', 'entityId', 'previousHash', 'hash'].every((key) => typeof value[key] === 'string') &&
    (value.detail === undefined || typeof value.detail === 'string');
}
function isAuditRecordArray(value: unknown): value is AuditRecord[] {
  return Array.isArray(value) && value.every(isAuditRecord);
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().map((key) => JSON.stringify(key) + ':' + canonical(record[key])).join(',') + '}';
  }
  return JSON.stringify(value) ?? 'null';
}
async function sha256(value: unknown): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error('Web Crypto SHA-256 is unavailable.');
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function isAuditArchiveShape(value: unknown): value is AuditArchiveEntry {
  if (!isRecord(value)) return false;
  return value.format === 'shuttle-audit-archive' && value.version === 1 &&
    typeof value.id === 'string' && typeof value.archivedAt === 'string' &&
    typeof value.previousArchiveHash === 'string' && typeof value.previousRecordHash === 'string' &&
    typeof value.firstRecordId === 'string' && typeof value.lastRecordId === 'string' &&
    typeof value.firstRecordHash === 'string' && typeof value.lastRecordHash === 'string' &&
    Number.isInteger(value.recordCount) && Number(value.recordCount) > 0 &&
    typeof value.recordsDigest === 'string' && isAuditRecordArray(value.records) &&
    value.records.length === value.recordCount && typeof value.archiveHash === 'string';
}
function isAuditArchiveArray(value: unknown): value is AuditArchiveEntry[] {
  return Array.isArray(value) && value.every(isAuditArchiveShape);
}
async function verifyAuditDataset(active: AuditRecord[], archives: AuditArchiveEntry[]): Promise<boolean> {
  let previousArchiveHash = AUDIT_GENESIS_HASH;
  let previousRecordHash = AUDIT_GENESIS_HASH;
  for (const archive of archives) {
    if (archive.previousArchiveHash !== previousArchiveHash || archive.previousRecordHash !== previousRecordHash) return false;
    if (await sha256(archive.records) !== archive.recordsDigest) return false;
    if (!(await verifyAuditChain(archive.records, globalThis.crypto, previousRecordHash)).valid) return false;
    const first = archive.records[0];
    const last = archive.records[archive.records.length - 1];
    if (!first || !last || first.id !== archive.firstRecordId || last.id !== archive.lastRecordId ||
        first.hash !== archive.firstRecordHash || last.hash !== archive.lastRecordHash) return false;
    const unsigned = { ...archive } as Record<string, unknown>;
    delete unsigned.archiveHash;
    if (await sha256(unsigned) !== archive.archiveHash) return false;
    previousArchiveHash = archive.archiveHash;
    previousRecordHash = last.hash;
  }
  return (await verifyAuditChain(active, globalThis.crypto, previousRecordHash)).valid;
}
function invalidAuditResult(key: string, message: string): AdapterResult {
  return { status: 'invalid-source', key, message };
}
function failedAuditResult(key: string, message: string): AdapterResult {
  return { status: 'failed', key, message };
}
function parseArray(raw: string | null): unknown[] | null {
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value : null;
  } catch { return null; }
}

/**
 * Imports active records and archive envelopes separately after validating the
 * complete hash chain. A pending marker blocks automatic import and remains untouched.
 */
export async function importAuditData(legacyStorage: LegacyReadStorage = globalThis.localStorage, context?: MigrationStorageContext): Promise<AdapterResult[]> {
  /**
   * ATOMICITY CONSTRAINT (2B-4 dependency):
   *
   * This adapter verifies the complete audit ledger (active + archives) BEFORE
   * writing, but it imports each key via a separate `set()` call. If active is
   * imported but archives returns `conflict` or `failed`, the destination store
   * will contain a partial audit ledger that is not internally consistent.
   *
   * The 2B-1 `set()` API writes to the ACTIVE generation, not to a staging
   * generation. Therefore 2B-4 (migration orchestrator) MUST NOT call this
   * adapter directly against the active generation. It must use ONE of:
   *
   *   (A) A staging-generation writer that 2B-4 introduces (preferred), OR
   *   (B) A rollback procedure: if `importAuditData` returns partial success,
   *       2B-4 must delete the successfully-imported key (via `remove()`) before
   *       reporting failure to the user, OR
   *   (C) A pre-flight check in 2B-4 that asserts BOTH `audit.active` and
   *       `audit.archives` are ABSENT from the destination before calling this
   *       adapter, so that neither can return `already-synced` or `conflict`.
   *
   * This adapter alone cannot guarantee atomicity because the underlying storage
   * API does not support multi-key transactions across keys.
   */
  let pending: string | null;
  try { pending = readAuditArchivePendingMarker(legacyStorage); }
  catch (error) {
    if (error instanceof TypeError) throw error;
    return [
      failedAuditResult('audit.active', 'The audit recovery marker could not be read.'),
      failedAuditResult('audit.archives', 'The audit recovery marker could not be read.')
    ];
  }
  if (pending !== null) {
    const message = 'An audit archive is pending. The separate marker and source records were preserved; resolve the archive explicitly before importing.';
    return [invalidAuditResult('audit.active', message), invalidAuditResult('audit.archives', message)];
  }

  let activeRaw: string | null;
  let archivesRaw: string | null;
  try {
    activeRaw = legacyStorage.getItem(AUDIT_LEGACY_KEY_MAP.active.legacyKey);
    archivesRaw = legacyStorage.getItem(AUDIT_LEGACY_KEY_MAP.archives.legacyKey);
  } catch {
    return [
      failedAuditResult('audit.active', 'Audit source records could not be read.'),
      failedAuditResult('audit.archives', 'Audit source records could not be read.')
    ];
  }
  const activeParsed = parseArray(activeRaw);
  const archivesParsed = parseArray(archivesRaw);
  if (activeParsed === null) return [invalidAuditResult('audit.active', 'Audit active records are not a valid JSON array.')];
  if (archivesParsed === null) return [invalidAuditResult('audit.archives', 'Audit archive records are not a valid JSON array.')];
  if (!isAuditRecordArray(activeParsed)) return [invalidAuditResult('audit.active', 'Audit active records contain an invalid record shape.')];
  if (!isAuditArchiveArray(archivesParsed)) return [invalidAuditResult('audit.archives', 'Audit archives contain an invalid archive shape.')];

  try {
    if (!(await verifyAuditDataset(activeParsed, archivesParsed))) {
      return [
        invalidAuditResult('audit.active', 'The combined audit ledger failed integrity verification; no records were imported.'),
        invalidAuditResult('audit.archives', 'The combined audit ledger failed integrity verification; no records were imported.')
      ];
    }
  } catch {
    return [
      invalidAuditResult('audit.active', 'The combined audit ledger could not be verified; no records were imported.'),
      invalidAuditResult('audit.archives', 'The combined audit ledger could not be verified; no records were imported.')
    ];
  }

  const activeCanonical = canonical(activeParsed);
  const archivesCanonical = canonical(archivesParsed);
  const activeResult = await importMappedLegacyKey(
    AUDIT_LEGACY_KEY_MAP.active.legacyKey,
    (value): value is AuditRecord[] => isAuditRecordArray(value) && canonical(value) === activeCanonical,
    legacyStorage,
    undefined,
    'audit',
    context
  );
  const archivesResult = await importMappedLegacyKey(
    AUDIT_LEGACY_KEY_MAP.archives.legacyKey,
    (value): value is AuditArchiveEntry[] => isAuditArchiveArray(value) && canonical(value) === archivesCanonical,
    legacyStorage,
    undefined,
    'audit',
    context
  );
  return [
    await importDefaultForMissing(activeResult, [], context),
    await importDefaultForMissing(archivesResult, [], context)
  ];
}

export function getPreservedAuditArchivePendingMarker(legacyStorage: LegacyReadStorage = globalThis.localStorage): string | null {
  return readAuditArchivePendingMarker(legacyStorage);
}
export const PRESERVED_AUDIT_PENDING_KEY = AUDIT_ARCHIVE_PENDING_LEGACY_KEY;
