import { sanitizeSpreadsheetCell } from '../data/csvSafety';

export interface AuditRecordInput {
  actorId: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  detail?: string;
}

export interface AuditRecord extends AuditRecordInput {
  id: string;
  timestamp: string;
  previousHash: string;
  hash: string;
}

export interface AuditArchiveEntry {
  format: 'shuttle-audit-archive';
  version: 1;
  id: string;
  archivedAt: string;
  previousArchiveHash: string;
  previousRecordHash: string;
  firstRecordId: string;
  lastRecordId: string;
  firstRecordHash: string;
  lastRecordHash: string;
  recordCount: number;
  recordsDigest: string;
  records: AuditRecord[];
  archiveHash: string;
}

export interface AuditStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface AuditAnchor {
  archiveHash: string;
  lastRecordHash: string;
  archivedRecordCount: number;
}

export interface AuditLedgerVerification {
  valid: boolean;
  activeChecked: number;
  archivedChecked: number;
  archiveCount: number;
  brokenArchiveIndex: number | null;
  brokenRecordIndex: number | null;
  reason?: string;
}

export const AUDIT_STORAGE_KEY = 'shuttle-car-automation-v1:audit-log';
export const AUDIT_ARCHIVE_STORAGE_KEY = 'shuttle-car-automation-v1:audit-archives';
export const AUDIT_ARCHIVE_PENDING_KEY = 'shuttle-car-automation-v1:audit-archive-pending';
export const AUDIT_GENESIS_HASH = 'GENESIS';
export const MAX_RECORDS = 5000;
let appendQueue: Promise<unknown> = Promise.resolve();

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function sha256(value: string, cryptoApi: Crypto = globalThis.crypto): Promise<string> {
  if (!cryptoApi?.subtle) throw new Error('Web Crypto SHA-256 is unavailable in this environment.');
  const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function readJsonArray<T>(storage: AuditStorage, key: string, label: string): T[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`${label} is not valid JSON; integrity cannot be established.`); }
  if (!Array.isArray(parsed)) throw new Error(`${label} root is not an array; integrity cannot be established.`);
  return parsed as T[];
}

export function readAuditRecords(storage: AuditStorage = localStorage): AuditRecord[] {
  if (storage.getItem(AUDIT_ARCHIVE_PENDING_KEY) !== null) {
    throw new Error('An audit archive transaction is pending. Complete recovery before reading or appending new events.');
  }
  // Keep malformed entries so verification fails visibly instead of silently
  // filtering evidence and incorrectly reporting a clean chain.
  return readJsonArray<AuditRecord>(storage, AUDIT_STORAGE_KEY, 'Audit log');
}

export function readAuditArchives(storage: AuditStorage = localStorage): AuditArchiveEntry[] {
  return readJsonArray<AuditArchiveEntry>(storage, AUDIT_ARCHIVE_STORAGE_KEY, 'Audit archive');
}

export async function verifyAuditChain(
  records: readonly AuditRecord[] = readAuditRecords(),
  cryptoApi: Crypto = globalThis.crypto,
  initialPreviousHash = AUDIT_GENESIS_HASH
): Promise<{ valid: boolean; checked: number; brokenIndex: number | null; reason?: string }> {
  let previousHash = initialPreviousHash;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || typeof record !== 'object' ||
      !['id', 'timestamp', 'actorId', 'actorRole', 'action', 'entityType', 'entityId', 'previousHash', 'hash']
        .every((key) => typeof (record as unknown as Record<string, unknown>)[key] === 'string')) {
      return { valid: false, checked: index, brokenIndex: index, reason: 'Record structure is invalid.' };
    }
    if (record.previousHash !== previousHash) {
      return { valid: false, checked: index, brokenIndex: index, reason: 'Previous hash does not match the preceding record.' };
    }
    const { hash, ...unsigned } = record;
    const expected = await sha256(canonical(unsigned), cryptoApi);
    if (hash !== expected) {
      return { valid: false, checked: index + 1, brokenIndex: index, reason: 'Record hash does not match its contents.' };
    }
    previousHash = hash;
  }
  return { valid: true, checked: records.length, brokenIndex: null };
}

function archiveUnsigned(entry: Omit<AuditArchiveEntry, 'archiveHash'> | AuditArchiveEntry) {
  const { archiveHash: _hash, ...unsigned } = entry as AuditArchiveEntry;
  return unsigned;
}

async function verifyArchiveEntries(
  archives: readonly AuditArchiveEntry[],
  cryptoApi: Crypto
): Promise<{ valid: boolean; checked: number; lastArchiveHash: string; lastRecordHash: string; archivedRecordCount: number; brokenIndex: number | null; reason?: string }> {
  let previousArchiveHash = AUDIT_GENESIS_HASH;
  let previousRecordHash = AUDIT_GENESIS_HASH;
  let archivedRecordCount = 0;

  for (let index = 0; index < archives.length; index += 1) {
    const archive = archives[index];
    if (!archive || typeof archive !== 'object' ||
      archive.format !== 'shuttle-audit-archive' || archive.version !== 1 ||
      typeof archive.id !== 'string' || typeof archive.archivedAt !== 'string' ||
      typeof archive.previousArchiveHash !== 'string' || typeof archive.previousRecordHash !== 'string' ||
      typeof archive.recordsDigest !== 'string' || !Array.isArray(archive.records) ||
      !Number.isInteger(archive.recordCount) || archive.recordCount < 1 ||
      typeof archive.archiveHash !== 'string') {
      return { valid: false, checked: archivedRecordCount, lastArchiveHash: previousArchiveHash, lastRecordHash: previousRecordHash, archivedRecordCount, brokenIndex: index, reason: 'Archive manifest structure is invalid.' };
    }
    if (archive.previousArchiveHash !== previousArchiveHash || archive.previousRecordHash !== previousRecordHash) {
      return { valid: false, checked: archivedRecordCount, lastArchiveHash: previousArchiveHash, lastRecordHash: previousRecordHash, archivedRecordCount, brokenIndex: index, reason: 'Archive chain anchor does not match the previous archive.' };
    }
    if (archive.records.length !== archive.recordCount) {
      return { valid: false, checked: archivedRecordCount, lastArchiveHash: previousArchiveHash, lastRecordHash: previousRecordHash, archivedRecordCount, brokenIndex: index, reason: 'Archive record count does not match its manifest.' };
    }
    if (await sha256(canonical(archive.records), cryptoApi) !== archive.recordsDigest) {
      return { valid: false, checked: archivedRecordCount, lastArchiveHash: previousArchiveHash, lastRecordHash: previousRecordHash, archivedRecordCount, brokenIndex: index, reason: 'Archive record digest does not match its contents.' };
    }
    const chain = await verifyAuditChain(archive.records, cryptoApi, previousRecordHash);
    if (!chain.valid) {
      return { valid: false, checked: archivedRecordCount + chain.checked, lastArchiveHash: previousArchiveHash, lastRecordHash: previousRecordHash, archivedRecordCount, brokenIndex: index, reason: `Archived record chain is invalid: ${chain.reason}` };
    }
    const first = archive.records[0];
    const last = archive.records[archive.records.length - 1];
    if (first.id !== archive.firstRecordId || last.id !== archive.lastRecordId ||
      first.hash !== archive.firstRecordHash || last.hash !== archive.lastRecordHash) {
      return { valid: false, checked: archivedRecordCount + chain.checked, lastArchiveHash: previousArchiveHash, lastRecordHash: previousRecordHash, archivedRecordCount, brokenIndex: index, reason: 'Archive boundary records do not match the manifest.' };
    }
    const expectedArchiveHash = await sha256(canonical(archiveUnsigned(archive)), cryptoApi);
    if (expectedArchiveHash !== archive.archiveHash) {
      return { valid: false, checked: archivedRecordCount + chain.checked, lastArchiveHash: previousArchiveHash, lastRecordHash: previousRecordHash, archivedRecordCount, brokenIndex: index, reason: 'Archive manifest hash does not match its contents.' };
    }
    previousArchiveHash = archive.archiveHash;
    previousRecordHash = last.hash;
    archivedRecordCount += archive.recordCount;
  }

  return { valid: true, checked: archivedRecordCount, lastArchiveHash: previousArchiveHash, lastRecordHash: previousRecordHash, archivedRecordCount, brokenIndex: null };
}

export async function getAuditAnchor(
  storage: AuditStorage = localStorage,
  cryptoApi: Crypto = globalThis.crypto
): Promise<AuditAnchor> {
  const archives = readAuditArchives(storage);
  const verification = await verifyArchiveEntries(archives, cryptoApi);
  if (!verification.valid) throw new Error(`Audit archive integrity failed at archive ${verification.brokenIndex}: ${verification.reason}`);
  return {
    archiveHash: verification.lastArchiveHash,
    lastRecordHash: verification.lastRecordHash,
    archivedRecordCount: verification.archivedRecordCount
  };
}

/**
 * Resume an interrupted archive operation. The pending copy contains the full
 * active records, so the old ledger is never discarded before an archive copy
 * has been persisted and verified.
 */
export async function recoverPendingAuditArchive(
  storage: AuditStorage = localStorage,
  cryptoApi: Crypto = globalThis.crypto
): Promise<boolean> {
  const pendingRaw = storage.getItem(AUDIT_ARCHIVE_PENDING_KEY);
  if (pendingRaw === null) return false;

  let pending: { archive: AuditArchiveEntry };
  try { pending = JSON.parse(pendingRaw) as { archive: AuditArchiveEntry }; }
  catch { throw new Error('Pending audit archive is unreadable. Export the raw audit storage before attempting recovery.'); }
  if (!pending?.archive || pending.archive.format !== 'shuttle-audit-archive') {
    throw new Error('Pending audit archive has an invalid format. No audit data was changed.');
  }

  const existing = readJsonArray<AuditArchiveEntry>(storage, AUDIT_ARCHIVE_STORAGE_KEY, 'Audit archive');
  const found = existing.some((entry) => entry.archiveHash === pending.archive.archiveHash);
  const nextArchives = found ? existing : [...existing, pending.archive];
  const archiveVerification = await verifyArchiveEntries(nextArchives, cryptoApi);
  if (!archiveVerification.valid) throw new Error(`Pending archive cannot be verified: ${archiveVerification.reason}`);

  const activeRaw = storage.getItem(AUDIT_STORAGE_KEY);
  const active = activeRaw === null ? [] : (() => {
    try {
      const parsed: unknown = JSON.parse(activeRaw);
      if (!Array.isArray(parsed)) throw new Error('Active audit log root is invalid.');
      return parsed as AuditRecord[];
    } catch {
      throw new Error('Active audit log is unreadable during archive recovery. Raw bytes were preserved.');
    }
  })();
  if (active.length > 0) {
    const digest = await sha256(canonical(active), cryptoApi);
    if (digest !== pending.archive.recordsDigest) {
      throw new Error('Active audit records differ from the pending archive copy. Automatic clearing was refused.');
    }
  }

  storage.setItem(AUDIT_ARCHIVE_STORAGE_KEY, JSON.stringify(nextArchives));
  storage.setItem(AUDIT_STORAGE_KEY, '[]');
  if (!storage.removeItem) throw new Error('Storage removal is unavailable; pending archive marker remains for recovery.');
  storage.removeItem(AUDIT_ARCHIVE_PENDING_KEY);
  return true;
}

export async function verifyAuditLedger(
  storage: AuditStorage = localStorage,
  cryptoApi: Crypto = globalThis.crypto
): Promise<AuditLedgerVerification> {
  await recoverPendingAuditArchive(storage, cryptoApi);
  const archives = readAuditArchives(storage);
  const archived = await verifyArchiveEntries(archives, cryptoApi);
  if (!archived.valid) {
    return {
      valid: false, activeChecked: 0, archivedChecked: archived.checked,
      archiveCount: archives.length, brokenArchiveIndex: archived.brokenIndex,
      brokenRecordIndex: null, reason: archived.reason
    };
  }
  let active: AuditRecord[];
  try { active = readAuditRecords(storage); }
  catch (reason) {
    return {
      valid: false, activeChecked: 0, archivedChecked: archived.checked,
      archiveCount: archives.length, brokenArchiveIndex: null,
      brokenRecordIndex: null, reason: reason instanceof Error ? reason.message : 'Active audit log could not be read.'
    };
  }
  const activeVerification = await verifyAuditChain(active, cryptoApi, archived.lastRecordHash);
  return {
    valid: activeVerification.valid,
    activeChecked: activeVerification.checked,
    archivedChecked: archived.checked,
    archiveCount: archives.length,
    brokenArchiveIndex: null,
    brokenRecordIndex: activeVerification.brokenIndex,
    ...(activeVerification.reason ? { reason: activeVerification.reason } : {})
  };
}

export async function readAllAuditRecords(
  storage: AuditStorage = localStorage,
  cryptoApi: Crypto = globalThis.crypto
): Promise<AuditRecord[]> {
  const ledger = await verifyAuditLedger(storage, cryptoApi);
  if (!ledger.valid) throw new Error(ledger.reason || 'Audit ledger integrity verification failed.');
  const archives = readAuditArchives(storage);
  const active = readAuditRecords(storage);
  return [...archives.flatMap((archive) => archive.records), ...active];
}

export async function archiveAuditRecords(
  storage: AuditStorage = localStorage,
  now = new Date(),
  cryptoApi: Crypto = globalThis.crypto
): Promise<AuditArchiveEntry> {
  await recoverPendingAuditArchive(storage, cryptoApi);
  const archives = readAuditArchives(storage);
  const archiveVerification = await verifyArchiveEntries(archives, cryptoApi);
  if (!archiveVerification.valid) throw new Error(`Audit archive chain is invalid: ${archiveVerification.reason}`);

  const active = readAuditRecords(storage);
  if (active.length === 0) throw new Error('There are no active audit records to archive.');
  const activeVerification = await verifyAuditChain(active, cryptoApi, archiveVerification.lastRecordHash);
  if (!activeVerification.valid) throw new Error(`Active audit chain is invalid at record ${activeVerification.brokenIndex}.`);

  const unsigned = {
    format: 'shuttle-audit-archive' as const,
    version: 1 as const,
    id: `AUD-ARCH-${now.getTime()}-${cryptoApi.randomUUID?.() || 'local'}`,
    archivedAt: now.toISOString(),
    previousArchiveHash: archiveVerification.lastArchiveHash,
    previousRecordHash: archiveVerification.lastRecordHash,
    firstRecordId: active[0].id,
    lastRecordId: active[active.length - 1].id,
    firstRecordHash: active[0].hash,
    lastRecordHash: active[active.length - 1].hash,
    recordCount: active.length,
    recordsDigest: await sha256(canonical(active), cryptoApi),
    records: active
  };
  const archive: AuditArchiveEntry = {
    ...unsigned,
    archiveHash: await sha256(canonical(unsigned), cryptoApi)
  };

  // Stage a full recovery copy first. If any later storage write fails, the
  // next ledger read can finish the same transaction without losing records.
  storage.setItem(AUDIT_ARCHIVE_PENDING_KEY, JSON.stringify({ archive }));
  await recoverPendingAuditArchive(storage, cryptoApi);
  return archive;
}

export function filterAuditRecords(
  records: readonly AuditRecord[],
  filters: { query?: string; action?: string; entityType?: string; actorId?: string; from?: string; to?: string }
): AuditRecord[] {
  const query = (filters.query || '').trim().toLocaleLowerCase();
  const action = (filters.action || '').trim();
  const entityType = (filters.entityType || '').trim();
  const actorId = (filters.actorId || '').trim().toLocaleLowerCase();
  const from = filters.from ? Date.parse(filters.from) : Number.NEGATIVE_INFINITY;
  const to = filters.to ? Date.parse(filters.to) + 86_400_000 - 1 : Number.POSITIVE_INFINITY;
  return records.filter((record) => {
    const timestamp = Date.parse(record.timestamp);
    if (!Number.isFinite(timestamp) || timestamp < from || timestamp > to) return false;
    if (action && record.action !== action) return false;
    if (entityType && record.entityType !== entityType) return false;
    if (actorId && !record.actorId.toLocaleLowerCase().includes(actorId)) return false;
    if (query) {
      const content = [record.id, record.action, record.entityType, record.entityId, record.actorId, record.actorRole, record.detail]
        .join(' ').toLocaleLowerCase();
      if (!content.includes(query)) return false;
    }
    return true;
  });
}

export function auditRecordsToCsv(records: readonly AuditRecord[]): string {
  const columns: Array<keyof AuditRecord> = [
    'id', 'timestamp', 'actorId', 'actorRole', 'action', 'entityType', 'entityId', 'detail', 'previousHash', 'hash'
  ];
  const quote = (value: string | number | boolean | null | undefined) => {
    const safeValue = sanitizeSpreadsheetCell(value);
    return `"${String(safeValue ?? '').replace(/"/g, '""')}"`;
  };
  return [
    columns.map(quote).join(','),
    ...records.map((record) => columns.map((column) => quote(record[column])).join(','))
  ].join('\r\n');
}

export function appendAuditRecord(
  input: AuditRecordInput,
  storage: AuditStorage = localStorage,
  now = new Date(),
  cryptoApi: Crypto = globalThis.crypto
): Promise<AuditRecord> {
  const operation = appendQueue.then(async () => {
    await recoverPendingAuditArchive(storage, cryptoApi);
    const existing = readAuditRecords(storage);
    const anchor = await getAuditAnchor(storage, cryptoApi);
    const integrity = await verifyAuditChain(existing, cryptoApi, anchor.lastRecordHash);
    if (!integrity.valid) throw new Error(`Audit log integrity check failed at record ${integrity.brokenIndex}. New records were not appended.`);
    if (existing.length >= MAX_RECORDS) {
      throw new Error(`Audit log reached its ${MAX_RECORDS}-record active limit. Archive active records before continuing; records were not truncated.`);
    }
    const previousHash = existing.length > 0 ? existing[existing.length - 1].hash : anchor.lastRecordHash;
    const randomSuffix = cryptoApi.randomUUID?.() || Array.from(cryptoApi.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const unsigned = {
      id: `AUD-${now.getTime()}-${randomSuffix}`,
      timestamp: now.toISOString(),
      actorId: input.actorId.trim(),
      actorRole: input.actorRole.trim(),
      action: input.action.trim(),
      entityType: input.entityType.trim(),
      entityId: input.entityId.trim(),
      detail: input.detail?.trim() || '',
      previousHash
    };
    if (![unsigned.actorId, unsigned.actorRole, unsigned.action, unsigned.entityType, unsigned.entityId].every(Boolean)) {
      throw new Error('Audit actor, role, action, entity type and entity ID are required.');
    }
    const record: AuditRecord = { ...unsigned, hash: await sha256(canonical(unsigned), cryptoApi) };
    storage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([...existing, record]));
    return record;
  });
  appendQueue = operation.catch(() => undefined);
  return operation;
}
