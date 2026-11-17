import { defaultSettings } from '../data/mockData';
import { VersionedStorageEngine, type StorageLike, type StorageEnvelopeInspection } from './storageEngine';

export const OPERATIONAL_PREFIX = 'shuttle-car-automation-v7:';
export const OPERATIONAL_STORAGE_SCHEMA = 1;
export const OPERATIONAL_COLLECTIONS = [
  'language', 'theme', 'sidebarCollapsed', 'shuttles', 'batteries', 'faults', 'maintenance',
  'connections', 'notifications', 'settings', 'dailyReports', 'shifts'
] as const;
export type OperationalCollection = typeof OPERATIONAL_COLLECTIONS[number];
export type RecoverySource = 'primary' | 'previous' | 'legacy' | 'empty';

interface SnapshotSummary {
  status: 'missing' | 'valid' | 'invalid' | 'schema-mismatch';
  revision?: number;
  schemaVersion?: number;
  savedAt?: string;
  reason?: string;
}

interface LegacySummary {
  status: 'missing' | 'valid' | 'invalid';
  preview?: string;
  reason?: string;
}

export interface OperationalRecoveryItem {
  collection: OperationalCollection;
  reason: string;
  primary: SnapshotSummary;
  previous: SnapshotSummary;
  legacy: LegacySummary;
  primaryData?: unknown;
  previousData?: unknown;
  legacyData?: unknown;
  canUseEmpty: boolean;
}

export type OperationalBootstrapResult =
  | { status: 'ready'; issues: string[] }
  | { status: 'recovery-required'; issues: string[]; items: OperationalRecoveryItem[] };

const engineCache = new WeakMap<StorageLike, Map<string, VersionedStorageEngine<unknown>>>();
const saveQueues = new WeakMap<StorageLike, Map<string, Promise<unknown>>>();

function getEngine(storage: StorageLike, collection: OperationalCollection): VersionedStorageEngine<unknown> {
  let engines = engineCache.get(storage);
  if (!engines) { engines = new Map(); engineCache.set(storage, engines); }
  let engine = engines.get(collection);
  if (!engine) {
    engine = new VersionedStorageEngine({
      key: `${OPERATIONAL_PREFIX}verified:${collection}`,
      schemaVersion: OPERATIONAL_STORAGE_SCHEMA,
      storage
    });
    engines.set(collection, engine);
  }
  return engine;
}

function getQueue(storage: StorageLike): Map<string, Promise<unknown>> {
  let queues = saveQueues.get(storage);
  if (!queues) { queues = new Map(); saveQueues.set(storage, queues); }
  return queues;
}

function isLegacyShape(collection: OperationalCollection, value: unknown): boolean {
  const arrayCollections: OperationalCollection[] = [
    'shuttles', 'batteries', 'faults', 'maintenance', 'connections', 'notifications', 'dailyReports', 'shifts'
  ];
  if (arrayCollections.includes(collection)) return Array.isArray(value);
  if (collection === 'language') return value === 'ar' || value === 'en';
  if (collection === 'theme') return value === 'dark' || value === 'light';
  if (collection === 'sidebarCollapsed') return typeof value === 'boolean';
  if (collection === 'settings') return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  return false;
}

function safePreview(value: unknown): string {
  try {
    const serialized = JSON.stringify(value, null, 2) ?? 'null';
    return serialized.length > 1800 ? `${serialized.slice(0, 1800)}\n… preview truncated …` : serialized;
  } catch {
    return '[Preview unavailable]';
  }
}

function summarize<T>(entry: StorageEnvelopeInspection<T>): SnapshotSummary {
  if (entry.status === 'missing') return { status: 'missing' };
  if (entry.status === 'invalid') return { status: 'invalid', reason: entry.reason };
  return {
    status: entry.envelope.schemaVersion === OPERATIONAL_STORAGE_SCHEMA ? 'valid' : 'schema-mismatch',
    schemaVersion: entry.envelope.schemaVersion,
    revision: entry.envelope.revision,
    savedAt: entry.envelope.savedAt,
    ...(entry.envelope.schemaVersion === OPERATIONAL_STORAGE_SCHEMA ? {} : { reason: 'Snapshot schema does not match the current application schema.' })
  };
}

function legacyDefault(collection: OperationalCollection): unknown {
  switch (collection) {
    case 'language': return 'en';
    case 'theme': return 'dark';
    case 'sidebarCollapsed': return false;
    case 'settings': return defaultSettings;
    default: return [];
  }
}

function makeQuarantineKey(key: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${key}:quarantine:${stamp}-${suffix}`;
}

function quarantineRaw(storage: StorageLike, key: string, raw: string | null): string | null {
  if (raw === null) return null;
  const quarantineKey = makeQuarantineKey(key);
  storage.setItem(quarantineKey, raw);
  return quarantineKey;
}

function parseLegacy(collection: OperationalCollection, raw: string | null): {
  summary: LegacySummary;
  data?: unknown;
} {
  if (raw === null) return { summary: { status: 'missing' } };
  try {
    const value: unknown = JSON.parse(raw);
    if (!isLegacyShape(collection, value)) {
      return { summary: { status: 'invalid', reason: 'Legacy record does not match the expected collection type.' } };
    }
    return { summary: { status: 'valid', preview: safePreview(value) }, data: value };
  } catch (reason) {
    return {
      summary: { status: 'invalid', reason: reason instanceof Error ? reason.message : 'Legacy JSON is invalid.' }
    };
  }
}

/**
 * Inspects every collection without writing to, repairing, migrating or
 * replacing any data. A recovery decision is required whenever a non-empty
 * store contains a missing, damaged, or incompatible collection.
 */
export async function bootstrapOperationalStorage(storage: StorageLike = globalThis.localStorage): Promise<OperationalBootstrapResult> {
  const inspections = await Promise.all(OPERATIONAL_COLLECTIONS.map(async (collection) => {
    const engine = getEngine(storage, collection);
    const snapshot = await engine.inspect();
    const legacyKey = `${OPERATIONAL_PREFIX}${collection}`;
    const legacyRaw = storage.getItem(legacyKey);
    const legacy = parseLegacy(collection, legacyRaw);
    return { collection, engine, snapshot, legacyKey, legacyRaw, legacy };
  }));

  const storeHasAnyData = inspections.some(({ snapshot, legacyRaw }) =>
    snapshot.primary.status !== 'missing' || snapshot.previous.status !== 'missing' || legacyRaw !== null
  );
  if (!storeHasAnyData) {
    try { storage.setItem(`${OPERATIONAL_PREFIX}storage-issues`, '[]'); } catch { /* First run remains read-only until the app initializes. */ }
    return { status: 'ready', issues: [] };
  }

  const issues: string[] = [];
  const items: OperationalRecoveryItem[] = [];

  for (const entry of inspections) {
    const { collection, snapshot, legacyKey, legacyRaw, legacy } = entry;
    const primarySummary = summarize(snapshot.primary);
    const previousSummary = summarize(snapshot.previous);

    if (snapshot.primary.status === 'valid' &&
        snapshot.primary.envelope.schemaVersion === OPERATIONAL_STORAGE_SCHEMA) {
      // A valid primary is authoritative. Quarantine a damaged or incompatible
      // previous copy before normal writes can rotate over it.
      if (snapshot.previous.status === 'invalid' ||
          (snapshot.previous.status === 'valid' && snapshot.previous.envelope.schemaVersion !== OPERATIONAL_STORAGE_SCHEMA)) {
        quarantineRaw(storage, `${legacyKey}:verified:previous`, snapshot.previous.raw);
        storage.removeItem?.(`${legacyKey}:verified:previous`);
        issues.push(`${collection}: incompatible previous snapshot quarantined; verified primary retained.`);
      }

      const primaryData = snapshot.primary.envelope.payload;
      if (legacyRaw !== JSON.stringify(primaryData)) {
        if (legacyRaw !== null) quarantineRaw(storage, legacyKey, legacyRaw);
        try {
          storage.setItem(legacyKey, JSON.stringify(primaryData));
        } catch (reason) {
          items.push({
            collection, reason: `Verified primary is healthy, but the application compatibility cache could not be refreshed: ${reason instanceof Error ? reason.message : 'storage write failed'}.`,
            primary: primarySummary, previous: previousSummary, legacy: legacy.summary,
            primaryData, ...(snapshot.previous.status === 'valid' && snapshot.previous.envelope.schemaVersion === OPERATIONAL_STORAGE_SCHEMA ? { previousData: snapshot.previous.envelope.payload } : {}),
            ...(legacy.data !== undefined ? { legacyData: legacy.data } : {}),
            canUseEmpty: false
          });
        }
      }
      continue;
    }

    const previousData = snapshot.previous.status === 'valid' &&
      snapshot.previous.envelope.schemaVersion === OPERATIONAL_STORAGE_SCHEMA
      ? snapshot.previous.envelope.payload
      : undefined;
    const primaryData = snapshot.primary.status === 'valid' ? snapshot.primary.envelope.payload : undefined;

    let reason = 'No compatible primary snapshot is available.';
    if (snapshot.primary.status === 'invalid') reason = snapshot.primary.reason;
    else if (snapshot.primary.status === 'valid') reason = `Primary snapshot uses schema ${snapshot.primary.envelope.schemaVersion}; current schema is ${OPERATIONAL_STORAGE_SCHEMA}.`;
    else if (snapshot.previous.status === 'valid' && snapshot.previous.envelope.schemaVersion !== OPERATIONAL_STORAGE_SCHEMA) reason = `Previous snapshot uses schema ${snapshot.previous.envelope.schemaVersion}; migration review is required.`;
    else if (snapshot.previous.status === 'invalid') reason = snapshot.previous.reason;

    if (snapshot.primary.status === 'missing' && snapshot.previous.status === 'missing' && legacy.status === 'valid') {
      reason = 'A valid legacy copy is available; review and explicitly migrate it before continuing.';
    } else if (snapshot.primary.status === 'missing' && snapshot.previous.status === 'valid') {
      reason = 'Primary snapshot is missing; a verified previous snapshot is available for preview and explicit restoration.';
    } else if (snapshot.primary.status === 'invalid' && previousData !== undefined) {
      reason = 'Primary snapshot failed validation; a verified previous snapshot is available for preview and explicit restoration.';
    } else if (snapshot.primary.status === 'missing' && snapshot.previous.status === 'missing' && legacy.status === 'missing') {
      reason = 'This collection is missing from a non-empty operational store. Choose an empty register explicitly; demo seed records will not be inserted.';
    }

    items.push({
      collection, reason, primary: primarySummary, previous: previousSummary, legacy: legacy.summary,
      ...(primaryData !== undefined ? { primaryData } : {}),
      ...(previousData !== undefined ? { previousData } : {}),
      ...(legacy.data !== undefined ? { legacyData: legacy.data } : {}),
      canUseEmpty: true
    });
  }

  try { storage.setItem(`${OPERATIONAL_PREFIX}storage-issues`, JSON.stringify(issues)); } catch { /* Recovery UI reports the write issue separately. */ }
  if (items.length > 0) return { status: 'recovery-required', issues, items };
  return { status: 'ready', issues };
}

/**
 * Commits a recovery choice only after the Recovery UI has shown the candidate.
 * All original raw copies are quarantined before any primary snapshot is changed.
 */
export async function resolveOperationalRecovery(
  collection: OperationalCollection,
  source: RecoverySource,
  storage: StorageLike = globalThis.localStorage
): Promise<{ revision: number; checksum: string }> {
  const engine = getEngine(storage, collection);
  const snapshot = await engine.inspect();
  const legacyKey = `${OPERATIONAL_PREFIX}${collection}`;
  const legacyRaw = storage.getItem(legacyKey);
  const legacy = parseLegacy(collection, legacyRaw);

  let data: unknown;
  if (source === 'primary') {
    if (snapshot.primary.status !== 'valid' || snapshot.primary.envelope.schemaVersion !== OPERATIONAL_STORAGE_SCHEMA) {
      throw new Error('The primary snapshot is not a compatible verified candidate.');
    }
    data = snapshot.primary.envelope.payload;
  } else if (source === 'previous') {
    if (snapshot.previous.status !== 'valid' || snapshot.previous.envelope.schemaVersion !== OPERATIONAL_STORAGE_SCHEMA) {
      throw new Error('No compatible verified previous snapshot is available.');
    }
    data = snapshot.previous.envelope.payload;
  } else if (source === 'legacy') {
    if (legacy.status !== 'valid' || legacy.data === undefined) throw new Error('The legacy copy is missing or invalid.');
    data = legacy.data;
  } else {
    data = legacyDefault(collection);
  }

  const primaryKey = `${OPERATIONAL_PREFIX}verified:${collection}`;
  const previousKey = `${primaryKey}:previous`;
  // Quarantine every pre-recovery byte copy, including a stale compatibility key.
  quarantineRaw(storage, primaryKey, snapshot.primary.raw);
  quarantineRaw(storage, previousKey, snapshot.previous.raw);
  if (legacyRaw !== null && source !== 'legacy') quarantineRaw(storage, legacyKey, legacyRaw);

  let saved: { revision: number; checksum: string };
  if (source === 'previous') {
    const restored = await engine.restorePrevious();
    if (restored.status !== 'recovered') throw new Error('The previous snapshot could not be restored.');
    saved = { revision: restored.revision, checksum: snapshot.previous.status === 'valid' ? snapshot.previous.envelope.checksum : '' };
    data = restored.data;
  } else {
    saved = await engine.replaceAfterRecovery(data);
  }

  storage.setItem(legacyKey, JSON.stringify(data));

  const journalKey = `${OPERATIONAL_PREFIX}recovery-journal`;
  let journal: Array<Record<string, unknown>> = [];
  const existingJournal = storage.getItem(journalKey);
  if (existingJournal !== null) {
    try {
      const parsed: unknown = JSON.parse(existingJournal);
      if (Array.isArray(parsed)) journal = parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
      else quarantineRaw(storage, journalKey, existingJournal);
    } catch {
      quarantineRaw(storage, journalKey, existingJournal);
    }
  }
  journal.push({
    id: `REC-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    collection,
    source,
    revision: saved.revision,
    checksum: saved.checksum
  });
  storage.setItem(journalKey, JSON.stringify(journal.slice(-500)));
  return saved;
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
