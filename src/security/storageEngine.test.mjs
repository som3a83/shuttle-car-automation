import test from 'node:test';
import assert from 'node:assert/strict';
import { VersionedStorageEngine } from './storageEngine.ts';

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('versioned storage saves checksummed data and increments revisions', async () => {
  const storage = new MemoryStorage();
  const engine = new VersionedStorageEngine({ key: 'operational-state', schemaVersion: 1, storage });
  assert.deepEqual(await engine.load(), { status: 'missing', data: null, revision: 0 });
  assert.equal((await engine.save({ shuttles: ['SC-01'] })).revision, 1);
  assert.equal((await engine.save({ shuttles: ['SC-01', 'SC-02'] })).revision, 2);
  const savedAt = JSON.parse(storage.getItem('operational-state')).savedAt;
  assert.deepEqual(await engine.load(), {
    status: 'loaded', data: { shuttles: ['SC-01', 'SC-02'] }, revision: 2, savedAt
  });
});

test('corrupt primary is reported without silently restoring the previous snapshot', async () => {
  const storage = new MemoryStorage();
  const engine = new VersionedStorageEngine({ key: 'operational-state', schemaVersion: 3, storage });
  await engine.save({ count: 5 }, new Date('2026-11-17T08:00:00.000Z'));
  await engine.save({ count: 6 }, new Date('2026-11-17T08:01:00.000Z'));
  const previousRaw = storage.getItem('operational-state:previous');
  storage.setItem('operational-state', '{broken');
  const inspection = await engine.inspect();
  assert.equal(inspection.primary.status, 'invalid');
  assert.equal(inspection.previous.status, 'valid');
  assert.equal(storage.getItem('operational-state:previous'), previousRaw);
  assert.equal((await engine.load()).status, 'corrupt');
  assert.equal(storage.getItem('operational-state'), '{broken');
});

test('explicit recovery restores the previewed verified previous snapshot', async () => {
  const storage = new MemoryStorage();
  const engine = new VersionedStorageEngine({ key: 'operational-state', schemaVersion: 3, storage });
  await engine.save({ count: 5 }, new Date('2026-11-17T08:00:00.000Z'));
  await engine.save({ count: 6 }, new Date('2026-11-17T08:01:00.000Z'));
  storage.setItem('operational-state', '{broken');
  const result = await engine.restorePrevious();
  assert.equal(result.status, 'recovered');
  assert.deepEqual(result.data, { count: 5 });
  assert.equal(result.revision, 1);
  const loaded = await engine.load();
  assert.equal(loaded.status, 'loaded');
  assert.deepEqual(loaded.data, { count: 5 });
});

test('checksum mismatch is not silently accepted', async () => {
  const storage = new MemoryStorage();
  const engine = new VersionedStorageEngine({ key: 'operational-state', schemaVersion: 1, storage });
  await engine.save({ safe: true });
  const record = JSON.parse(storage.getItem('operational-state'));
  record.payload.safe = false;
  storage.setItem('operational-state', JSON.stringify(record));
  assert.equal((await engine.load()).status, 'corrupt');
});

test('normal save refuses to overwrite damaged primary bytes even when a previous copy survives', async () => {
  const storage = new MemoryStorage();
  const engine = new VersionedStorageEngine({ key: 'operational-state', schemaVersion: 1, storage });
  await engine.save({ count: 1 });
  await engine.save({ count: 2 });
  const previous = storage.getItem('operational-state:previous');
  storage.setItem('operational-state', '{broken');
  await assert.rejects(() => engine.save({ count: 3 }), /Recovery Mode/);
  assert.equal(storage.getItem('operational-state'), '{broken');
  assert.equal(storage.getItem('operational-state:previous'), previous);
});

test('saving refuses to overwrite a schema version it does not understand', async () => {
  const storage = new MemoryStorage();
  const oldEngine = new VersionedStorageEngine({ key: 'operational-state', schemaVersion: 2, storage });
  await oldEngine.save({ preserve: true });
  const newEngine = new VersionedStorageEngine({ key: 'operational-state', schemaVersion: 1, storage });
  await assert.rejects(() => newEngine.save({ preserve: false }), /different schema version/);
});

test('invalid empty-string storage is treated as corrupt, not missing', async () => {
  const storage = new MemoryStorage();
  storage.setItem('operational-state', '');
  const engine = new VersionedStorageEngine({ key: 'operational-state', schemaVersion: 1, storage });
  assert.equal((await engine.inspect()).primary.status, 'invalid');
  assert.equal((await engine.load()).status, 'corrupt');
});
