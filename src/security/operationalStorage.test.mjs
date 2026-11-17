import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrapOperationalStorage, OPERATIONAL_PREFIX, persistOperationalSnapshot,
  readOperationalStorageIssues
} from './operationalStorage.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('bootstrap migrates existing operational records into verified snapshots', async () => {
  const storage = new MemoryStorage();
  storage.setItem(`${OPERATIONAL_PREFIX}shuttles`, JSON.stringify([{ id: 'SC-01' }]));
  const issues = await bootstrapOperationalStorage(storage);
  assert.deepEqual(issues, []);
  assert.ok(storage.getItem(`${OPERATIONAL_PREFIX}verified:shuttles`));
});

test('bootstrap restores the verified primary from its previous snapshot', async () => {
  const storage = new MemoryStorage();
  await persistOperationalSnapshot('shifts', [{ id: 'SHIFT-1' }], storage);
  await persistOperationalSnapshot('shifts', [{ id: 'SHIFT-1' }, { id: 'SHIFT-2' }], storage);
  storage.setItem(`${OPERATIONAL_PREFIX}verified:shifts`, '{broken');
  const issues = await bootstrapOperationalStorage(storage);
  assert.ok(issues.some((issue) => issue.includes('shifts: restored')));
  assert.deepEqual(JSON.parse(storage.getItem(`${OPERATIONAL_PREFIX}shifts`)), [{ id: 'SHIFT-1' }]);
});

test('rapid saves are serialized and get unique monotonic revisions', async () => {
  const storage = new MemoryStorage();
  const results = await Promise.all([
    persistOperationalSnapshot('batteries', [{ id: 'BAT-1' }], storage),
    persistOperationalSnapshot('batteries', [{ id: 'BAT-1' }, { id: 'BAT-2' }], storage),
    persistOperationalSnapshot('batteries', [{ id: 'BAT-1' }, { id: 'BAT-2' }, { id: 'BAT-3' }], storage)
  ]);
  assert.deepEqual(results.map((result) => result.revision), [1, 2, 3]);
});

test('corrupt snapshots are quarantined and surfaced as storage issues', async () => {
  const storage = new MemoryStorage();
  storage.setItem(`${OPERATIONAL_PREFIX}verified:faults`, '{broken');
  const issues = await bootstrapOperationalStorage(storage);
  assert.ok(issues.some((issue) => issue.includes('faults:')));
  assert.ok([...storage.values.keys()].some((key) => key.includes('verified:faults:quarantine:')));
  assert.deepEqual(readOperationalStorageIssues(storage), issues);
});
