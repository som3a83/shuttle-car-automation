import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAuditRecord, appendAuditRecordAsync, archiveAuditRecords, archiveAuditRecordsAsync, AUDIT_ARCHIVE_PENDING_KEY, AUDIT_ARCHIVE_STORAGE_KEY, AUDIT_STORAGE_KEY, auditRecordsToCsv, filterAuditRecords, readAllAuditRecords, readAllAuditRecordsAsync, readAuditRecords, readAuditRecordsAsync, recoverPendingAuditArchive, recoverPendingAuditArchiveAsync, verifyAuditChain, verifyAuditLedger, verifyAuditLedgerAsync } from './auditLog.ts';
import { LegacyFallbackEngine, StorageError } from '../storage/index.ts';

class MemoryStorage {
  values = new Map();
  failNextKey = null;
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) {
    if (this.failNextKey === key) {
      this.failNextKey = null;
      throw new Error('Quota exceeded');
    }
    this.values.set(key, String(value));
  }
  removeItem(key) { this.values.delete(key); }
}

const event = (action, entityId) => ({ actorId: 'local-admin', actorRole: 'Super Admin', action, entityType: 'shuttle', entityId, detail: 'Local test event' });

test('audit events are chained and independently verifiable', async () => {
  const storage = new MemoryStorage();
  await appendAuditRecord(event('created', 'SC-06'), storage, new Date('2026-11-17T08:00:00.000Z'));
  await appendAuditRecord(event('updated', 'SC-06'), storage, new Date('2026-11-17T08:01:00.000Z'));
  const records = JSON.parse(storage.getItem(AUDIT_STORAGE_KEY));
  assert.equal(records.length, 2);
  assert.equal(records[1].previousHash, records[0].hash);
  assert.deepEqual(await verifyAuditChain(records), { valid: true, checked: 2, brokenIndex: null });
});

test('audit chain detects edited records and refuses to append to a broken chain', async () => {
  const storage = new MemoryStorage();
  await appendAuditRecord(event('created', 'SC-06'), storage);
  const records = JSON.parse(storage.getItem(AUDIT_STORAGE_KEY));
  records[0].detail = 'tampered';
  storage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(records));
  const result = await verifyAuditChain(records);
  assert.equal(result.valid, false);
  assert.equal(result.brokenIndex, 0);
  await assert.rejects(() => appendAuditRecord(event('updated', 'SC-06'), storage), /integrity check failed/);
});

test('malformed audit entries are retained as integrity failures instead of filtered out', async () => {
  const storage = new MemoryStorage();
  storage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([{ action: 'tampered' }]));
  const records = JSON.parse(storage.getItem(AUDIT_STORAGE_KEY));
  const result = await verifyAuditChain(records);
  assert.equal(result.valid, false);
  assert.equal(result.brokenIndex, 0);
});

test('malformed JSON in the audit log is not reported as an empty clean ledger', async () => {
  const storage = new MemoryStorage();
  storage.setItem(AUDIT_STORAGE_KEY, '{broken');
  await assert.rejects(() => appendAuditRecord(event('created', 'SC-06'), storage), /not valid JSON/);
});


test('archives retain every record and the active chain resumes from the archive anchor', async () => {
  const storage = new MemoryStorage();
  await appendAuditRecord(event('created', 'SC-01'), storage, new Date('2026-11-17T08:00:00.000Z'));
  await appendAuditRecord(event('updated', 'SC-01'), storage, new Date('2026-11-17T08:01:00.000Z'));
  const archive = await archiveAuditRecords(storage, new Date('2026-11-17T09:00:00.000Z'));

  assert.equal(archive.recordCount, 2);
  assert.equal(readAuditRecords(storage).length, 0);
  assert.equal(JSON.parse(storage.getItem(AUDIT_ARCHIVE_STORAGE_KEY)).length, 1);
  assert.equal(await verifyAuditLedger(storage).then(result => result.valid), true);

  const next = await appendAuditRecord(event('after-archive', 'SC-01'), storage, new Date('2026-11-17T09:01:00.000Z'));
  assert.equal(next.previousHash, archive.lastRecordHash);
  assert.deepEqual((await readAllAuditRecords(storage)).map(record => record.action), ['created', 'updated', 'after-archive']);
  const ledger = await verifyAuditLedger(storage);
  assert.equal(ledger.valid, true);
  assert.equal(ledger.archivedChecked, 2);
  assert.equal(ledger.activeChecked, 1);
});

test('an interrupted archive retains pending records and can be resumed without loss', async () => {
  const storage = new MemoryStorage();
  await appendAuditRecord(event('created', 'SC-02'), storage);
  await appendAuditRecord(event('updated', 'SC-02'), storage);
  const original = readAuditRecords(storage);
  storage.failNextKey = AUDIT_ARCHIVE_STORAGE_KEY;

  await assert.rejects(() => archiveAuditRecords(storage), /Quota exceeded/);
  assert.ok(storage.getItem(AUDIT_ARCHIVE_PENDING_KEY));
  assert.deepEqual(JSON.parse(storage.getItem(AUDIT_STORAGE_KEY)), original);
  assert.throws(() => readAuditRecords(storage), /archive transaction is pending/);

  assert.equal(await recoverPendingAuditArchive(storage), true);
  assert.equal(storage.getItem(AUDIT_ARCHIVE_PENDING_KEY), null);
  assert.deepEqual(readAuditRecords(storage), []);
  assert.deepEqual((await readAllAuditRecords(storage)).map(record => record.action), ['created', 'updated']);
  assert.equal((await verifyAuditLedger(storage)).valid, true);
});

test('archive metadata and archived records are both checked for tampering', async () => {
  const storage = new MemoryStorage();
  await appendAuditRecord(event('created', 'SC-03'), storage);
  await archiveAuditRecords(storage);
  const archives = JSON.parse(storage.getItem(AUDIT_ARCHIVE_STORAGE_KEY));
  archives[0].records[0].detail = 'tampered archive';
  storage.setItem(AUDIT_ARCHIVE_STORAGE_KEY, JSON.stringify(archives));
  const result = await verifyAuditLedger(storage);
  assert.equal(result.valid, false);
  assert.equal(result.brokenArchiveIndex, 0);
});

test('audit archive and active records support search, filter and CSV export', async () => {
  const storage = new MemoryStorage();
  await appendAuditRecord(event('created', 'SC-04'), storage);
  await appendAuditRecord(event('battery-updated', 'BAT-04'), storage);
  await archiveAuditRecords(storage);
  await appendAuditRecord(event('fault-resolved', 'SC-04'), storage);
  const all = await readAllAuditRecords(storage);
  expectFilter(filterAuditRecords(all, { query: 'sc-04' }), ['created', 'fault-resolved']);
  expectFilter(filterAuditRecords(all, { action: 'battery-updated' }), ['battery-updated']);
  const csv = auditRecordsToCsv(all);
  assert.match(csv, /"id","timestamp","actorId"/);
  assert.match(csv, /fault-resolved/);
});


test('audit CSV prefixes formula-like user text before export', async () => {
  const storage = new MemoryStorage();
  await appendAuditRecord({
    ...event('fault-note', 'SC-01'),
    detail: '=HYPERLINK("https://example.invalid","open")'
  }, storage);
  const csv = auditRecordsToCsv(await readAllAuditRecords(storage));
  assert.match(csv, /"'=HYPERLINK\(/);
});

function expectFilter(records, actions) {
  assert.deepEqual(records.map(record => record.action), actions);
}


test('async audit appends serialize same-tab work and preserve the SHA-256 chain', async () => {
  const storage = new MemoryStorage();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    const results = await Promise.all([
      appendAuditRecordAsync(event('async-created', 'SC-ASYNC-01')),
      appendAuditRecordAsync(event('async-updated', 'SC-ASYNC-01')),
      appendAuditRecordAsync(event('async-checked', 'SC-ASYNC-01'))
    ]);
    assert.equal(results.length, 3);
    const records = await readAuditRecordsAsync();
    assert.deepEqual(records.map((record) => record.action), ['async-created', 'async-updated', 'async-checked']);
    assert.equal(records[1].previousHash, records[0].hash);
    assert.equal((await verifyAuditLedgerAsync()).valid, true);
    assert.deepEqual((await readAllAuditRecordsAsync()).map((record) => record.action),
      ['async-created', 'async-updated', 'async-checked']);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('async audit append retries a revision conflict and rebuilds from the latest active chain', async () => {
  const storage = new MemoryStorage();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalWrite = LegacyFallbackEngine.prototype.write;
  let conflicts = 0;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  LegacyFallbackEngine.prototype.write = async function(key, value, revision) {
    if (key === 'audit.active' && conflicts === 0) {
      conflicts += 1;
      throw new StorageError({
        code: 'STORAGE_CONFLICT', message: 'Simulated concurrent audit append.',
        key, expectedRevision: revision, actualRevision: (revision ?? 0) + 1
      });
    }
    return originalWrite.call(this, key, value, revision);
  };
  try {
    const record = await appendAuditRecordAsync(event('retried-event', 'SC-ASYNC-02'));
    assert.equal(conflicts, 1);
    assert.equal(record.action, 'retried-event');
    assert.equal((await readAuditRecordsAsync()).length, 1);
    assert.equal((await verifyAuditLedgerAsync()).valid, true);
  } finally {
    LegacyFallbackEngine.prototype.write = originalWrite;
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  }
});

test('async audit archive retains pending recovery data and resumes without loss', async () => {
  const storage = new MemoryStorage();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    await appendAuditRecordAsync(event('async-archive-one', 'SC-ASYNC-03'));
    await appendAuditRecordAsync(event('async-archive-two', 'SC-ASYNC-03'));
    storage.failNextKey = AUDIT_ARCHIVE_STORAGE_KEY;

    await assert.rejects(() => archiveAuditRecordsAsync(), /Quota exceeded/);
    assert.ok(storage.getItem(AUDIT_ARCHIVE_PENDING_KEY));
    assert.equal((await readAuditRecordsAsync()).length, 0);
    assert.equal(await recoverPendingAuditArchiveAsync(), true);
    assert.equal(storage.getItem(AUDIT_ARCHIVE_PENDING_KEY), null);
    assert.equal((await readAllAuditRecordsAsync()).length, 2);
    assert.equal((await verifyAuditLedgerAsync()).valid, true);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
