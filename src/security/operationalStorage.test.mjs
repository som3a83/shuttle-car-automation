import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bootstrapOperationalStorage, OPERATIONAL_PREFIX, persistOperationalSnapshot,
  readOperationalStorageIssues, resolveOperationalRecovery
} from './operationalStorage.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('a truly empty device is treated as first run', async () => {
  const storage = new MemoryStorage();
  assert.deepEqual(await bootstrapOperationalStorage(storage), { status: 'ready', issues: [] });
  assert.equal(storage.getItem(`${OPERATIONAL_PREFIX}shuttles`), null);
});

test('legacy records require preview and an explicit migration decision', async () => {
  const storage = new MemoryStorage();
  const legacy = [{ id: 'SC-01' }];
  const legacyKey = `${OPERATIONAL_PREFIX}shuttles`;
  storage.setItem(legacyKey, JSON.stringify(legacy));

  const inspection = await bootstrapOperationalStorage(storage);
  assert.equal(inspection.status, 'recovery-required');
  if (inspection.status !== 'recovery-required') return;
  const item = inspection.items.find((entry) => entry.collection === 'shuttles');
  assert.ok(item);
  assert.equal(item.legacy.status, 'valid');
  assert.deepEqual(item.legacyData, legacy);
  assert.equal(storage.getItem(`${OPERATIONAL_PREFIX}verified:shuttles`), null);
  assert.equal(storage.getItem(legacyKey), JSON.stringify(legacy));

  await resolveOperationalRecovery('shuttles', 'legacy', storage);
  assert.deepEqual(await bootstrapOperationalStorage(storage), { status: 'ready', issues: [] });
  assert.deepEqual(JSON.parse(storage.getItem(`${OPERATIONAL_PREFIX}verified:shuttles`)).payload, legacy);
});

test('verified previous snapshot is previewed and not restored until an explicit choice', async () => {
  const storage = new MemoryStorage();
  await persistOperationalSnapshot('shifts', [{ id: 'SHIFT-1' }], storage);
  await persistOperationalSnapshot('shifts', [{ id: 'SHIFT-1' }, { id: 'SHIFT-2' }], storage);
  storage.setItem(`${OPERATIONAL_PREFIX}verified:shifts`, '{broken');

  const inspection = await bootstrapOperationalStorage(storage);
  assert.equal(inspection.status, 'recovery-required');
  if (inspection.status !== 'recovery-required') return;
  const item = inspection.items.find((entry) => entry.collection === 'shifts');
  assert.ok(item);
  assert.deepEqual(item.previousData, [{ id: 'SHIFT-1' }]);
  assert.equal(storage.getItem(`${OPERATIONAL_PREFIX}verified:shifts`), '{broken');

  await resolveOperationalRecovery('shifts', 'previous', storage);
  assert.deepEqual(await bootstrapOperationalStorage(storage), { status: 'ready', issues: [] });
  assert.deepEqual(JSON.parse(storage.getItem(`${OPERATIONAL_PREFIX}shifts`)), [{ id: 'SHIFT-1' }]);
});

test('a corrupt-only collection is preserved until the user explicitly chooses an empty register', async () => {
  const storage = new MemoryStorage();
  storage.setItem(`${OPERATIONAL_PREFIX}verified:faults`, '{broken');

  const inspection = await bootstrapOperationalStorage(storage);
  assert.equal(inspection.status, 'recovery-required');
  assert.equal(storage.getItem(`${OPERATIONAL_PREFIX}verified:faults`), '{broken');
  assert.equal([...storage.values.keys()].some((key) => key.includes('verified:faults:quarantine:')), false);

  await resolveOperationalRecovery('faults', 'empty', storage);
  const after = await bootstrapOperationalStorage(storage);
  assert.equal(after.status, 'ready');
  assert.deepEqual(JSON.parse(storage.getItem(`${OPERATIONAL_PREFIX}faults`)), []);
  assert.equal([...storage.values.keys()].some((key) => key.includes('verified:faults:quarantine:')), true);
  assert.deepEqual(readOperationalStorageIssues(storage), []);
});

test('missing collection in a non-empty store is flagged instead of receiving demo seed data', async () => {
  const storage = new MemoryStorage();
  storage.setItem(`${OPERATIONAL_PREFIX}shuttles`, JSON.stringify([{ id: 'SC-01' }]));
  const inspection = await bootstrapOperationalStorage(storage);
  assert.equal(inspection.status, 'recovery-required');
  if (inspection.status !== 'recovery-required') return;
  const batteries = inspection.items.find((entry) => entry.collection === 'batteries');
  assert.ok(batteries);
  assert.equal(batteries.canUseEmpty, true);
  assert.equal(storage.getItem(`${OPERATIONAL_PREFIX}batteries`), null);
  await resolveOperationalRecovery('batteries', 'empty', storage);
  assert.deepEqual(JSON.parse(storage.getItem(`${OPERATIONAL_PREFIX}batteries`)), []);
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
