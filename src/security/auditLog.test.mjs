import test from 'node:test';
import assert from 'node:assert/strict';
import { appendAuditRecord, AUDIT_STORAGE_KEY, verifyAuditChain } from './auditLog.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
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
