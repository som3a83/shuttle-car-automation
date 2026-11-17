import { VersionedStorageEngine, type StorageLike } from './storageEngine.ts';

export const OPERATIONAL_PREFIX = 'shuttle-car-automation-v7:';
export const OPERATIONAL_STORAGE_SCHEMA = 1;
export const OPERATIONAL_COLLECTIONS = [
  'language', 'theme', 'sidebarCollapsed', 'shuttles', 'batteries', 'faults', 'maintenance',
  'connections', 'notifications', 'settings', 'dailyReports', 'shifts'
] as const;
export type OperationalCollection = typeof OPERATIONAL_COLLECTIONS[number];

const engineCache = new WeakMap<StorageLike, Map<string, VersionedStorageEngine<unknown>>>();
const saveQueues = new WeakMap<StorageLike, Map<string, Promise<unknown>>>();

function getEngine(storage: StorageLike, collection: OperationalCollection): VersionedStorageEngine<unknown> {
  let engines = engineCache.get(storage);
  if (!engines) { engines = new Map(); engineCache.set(storage, engines); }
  let engine = engines.get(collection);
  if (!engine) {
    engine = new VersionedStorageEngine({ key: `${OPERATIONAL_PREFIX}verified:${collection}`, schemaVersion: OPERATIONAL_STORAGE_SCHEMA, storage });
    engines.set(collection, engine);
  }
  return engine;
}

function getQueue(storage: StorageLike): Map<string, Promise<unknown>> {
  let queues = saveQueues.get(storage);
  if (!queues) { queues = new Map(); saveQueues.set(storage, queues); }
  return queues;
}

/**
 * Runs before React mounts. It upgrades legacy localStorage records into
 * checksummed snapshots and restores the last verified snapshot when possible.
 * A corrupt envelope is quarantined instead of being silently overwritten.
 */
export async function bootstrapOperationalStorage(storage: StorageLike = globalThis.localStorage): Promise<string[]> {
  const issues: string[] = [];
  for (const collection of OPERATIONAL_COLLECTIONS) {
    const legacyKey = `${OPERATIONAL_PREFIX}${collection}`;
    const engine = getEngine(storage, collection);
    try {
      const result = await engine.load();
      if (result.status === 'loaded' || result.status === 'recovered') {
        storage.setItem(legacyKey, JSON.stringify(result.data));
        if (result.status === 'recovered') issues.push(`${collection}: restored the last verified snapshot.`);
        continue;
      }
      const legacyRaw = storage.getItem(legacyKey);
      if (result.status === 'missing') {
        if (legacyRaw !== null) {
          const legacyValue: unknown = JSON.parse(legacyRaw);
          await engine.save(legacyValue);
        }
        continue;
      }

      const primaryKey = `${OPERATIONAL_PREFIX}verified:${collection}`;
      const backupKey = `${primaryKey}:previous`;
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const primaryRaw = storage.getItem(primaryKey);
      const backupRaw = storage.getItem(backupKey);
      if (primaryRaw !== null) storage.setItem(`${primaryKey}:quarantine:${stamp}`, primaryRaw);
      if (backupRaw !== null) storage.setItem(`${backupKey}:quarantine:${stamp}`, backupRaw);

      // A verified-format/schema mismatch is not safe to overwrite. Preserve
      // every byte and leave the legacy copy available for manual recovery.
      try {
        if (legacyRaw !== null) {
          const legacyValue: unknown = JSON.parse(legacyRaw);
          storage.removeItem?.(primaryKey);
          storage.removeItem?.(backupKey);
          await engine.save(legacyValue);
          issues.push(`${collection}: damaged verified snapshot quarantined; legacy copy was retained and re-migrated.`);
        } else {
          issues.push(`${collection}: verified snapshot is corrupt; original data was quarantined for recovery.`);
        }
      } catch (reason) {
        issues.push(`${collection}: migration blocked (${reason instanceof Error ? reason.message : 'unknown error'}).`);
      }
    } catch (reason) {
      issues.push(`${collection}: startup validation failed (${reason instanceof Error ? reason.message : 'unknown error'}).`);
    }
  }
  try { storage.setItem(`${OPERATIONAL_PREFIX}storage-issues`, JSON.stringify(issues)); } catch { /* Keep startup available if storage is full. */ }
  return issues;
}

/** Serializes writes per collection so rapid UI updates cannot reuse a revision. */
export function persistOperationalSnapshot(
  collection: OperationalCollection,
  value: unknown,
  storage: StorageLike = globalThis.localStorage
): Promise<{ revision: number; checksum: string }> {
  const queues = getQueue(storage);
  const previous = queues.get(collection) ?? Promise.resolve();
  const operation = previous.then(() => getEngine(storage, collection).save(value));
  queues.set(collection, operation.catch(() => undefined));
  return operation;
}

export function readOperationalStorageIssues(storage: StorageLike = globalThis.localStorage): string[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(`${OPERATIONAL_PREFIX}storage-issues`) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch { return ['Storage health information could not be read.']; }
}
