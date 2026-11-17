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

export interface AuditStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const AUDIT_STORAGE_KEY = 'shuttle-car-automation-v1:audit-log';
export const AUDIT_GENESIS_HASH = 'GENESIS';
const MAX_RECORDS = 5000;
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

export function readAuditRecords(storage: AuditStorage = localStorage): AuditRecord[] {
  const raw = storage.getItem(AUDIT_STORAGE_KEY);
  if (raw === null) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Audit log is not valid JSON; integrity cannot be established.'); }
  if (!Array.isArray(parsed)) throw new Error('Audit log root is not an array; integrity cannot be established.');
  // Keep malformed entries so verification fails visibly instead of silently
  // filtering evidence and incorrectly reporting a clean chain.
  return parsed as AuditRecord[];
}

export async function verifyAuditChain(
  records: readonly AuditRecord[] = readAuditRecords(),
  cryptoApi: Crypto = globalThis.crypto
): Promise<{ valid: boolean; checked: number; brokenIndex: number | null; reason?: string }> {
  let previousHash = AUDIT_GENESIS_HASH;
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

export function appendAuditRecord(
  input: AuditRecordInput,
  storage: AuditStorage = localStorage,
  now = new Date(),
  cryptoApi: Crypto = globalThis.crypto
): Promise<AuditRecord> {
  const operation = appendQueue.then(async () => {
    const existing = readAuditRecords(storage);
    const integrity = await verifyAuditChain(existing, cryptoApi);
    if (!integrity.valid) throw new Error(`Audit log integrity check failed at record ${integrity.brokenIndex}. New records were not appended.`);
    if (existing.length >= MAX_RECORDS) {
      throw new Error(`Audit log reached its ${MAX_RECORDS}-record retention limit. Export and archive it before continuing; records were not truncated.`);
    }
    const previousHash = existing.length > 0 ? existing[existing.length - 1].hash : AUDIT_GENESIS_HASH;
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
