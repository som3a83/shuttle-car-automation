import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { MigrationStorageContext, StorageKey } from '../../index';
import type { AdapterResult } from '../../adapters/legacyKeyMap';
import { verifyStagedMigration } from '../verification';

function contextWith(values: Partial<Record<StorageKey, unknown>>): MigrationStorageContext {
  const data = new Map<StorageKey, { value: unknown; revision: number }>();
  Object.entries(values).forEach(([key, value]) => data.set(key as StorageKey, { value, revision: 1 }));
  return {
    migrationId: 'verify-test',
    stagingGeneration: 'generation-verify-test',
    async get<T = unknown>(key: StorageKey): Promise<T | null> {
      return (data.get(key)?.value as T | undefined) ?? null;
    },
    async getWithRevision<T = unknown>(key: StorageKey) {
      const entry = data.get(key);
      return entry ? { value: entry.value as T, revision: entry.revision } : null;
    },
    async set<K extends StorageKey>(key: K, value: unknown) {
      const revision = (data.get(key)?.revision ?? 0) + 1;
      data.set(key, { value, revision });
      return { revision };
    }
  };
}

const expectedKeys: StorageKey[] = [
  'operational.shuttles',
  'audit.active',
  'audit.archives'
];

function resultsFor(shuttles: unknown[]): AdapterResult[] {
  return [
    { status: 'imported', key: 'operational.shuttles', value: shuttles, recordsCount: shuttles.length },
    { status: 'imported', key: 'audit.active', value: [], recordsCount: 0 },
    { status: 'imported', key: 'audit.archives', value: [], recordsCount: 0 }
  ];
}

describe('migration staging verification', () => {
  it('Test 1: verifies record counts for each migration key', async () => {
    const shuttles = [{ id: 'CS-01' }, { id: 'CS-02' }];
    const context = contextWith({
      'operational.shuttles': shuttles,
      'audit.active': [],
      'audit.archives': []
    });
    const report = await verifyStagedMigration(context, resultsFor(shuttles), expectedKeys);

    expect(report.valid).toBe(true);
    expect(report.checkedKeyCount).toBe(3);
    expect(report.keyResults[0].recordCount).toBe(2);
  });

  it('Test 2: verifies SHA-256 canonical checksums and rejects a changed staged value', async () => {
    const source = [{ id: 'CS-01', zone: 'A' }, { id: 'CS-02', zone: 'B' }];
    const changed = [{ id: 'CS-01', zone: 'A' }, { id: 'CS-02', zone: 'C' }];
    const context = contextWith({
      'operational.shuttles': changed,
      'audit.active': [],
      'audit.archives': []
    });
    const report = await verifyStagedMigration(context, resultsFor(source), expectedKeys);

    expect(report.valid).toBe(false);
    expect(report.keyResults[0].status).toBe('failed');
    expect(report.errors.some((error) => error.includes('SHA-256'))).toBe(true);
  });

  it('Test 3: accepts intact audit chains and rejects invalid audit records', async () => {
    const good = contextWith({
      'operational.shuttles': [],
      'audit.active': [],
      'audit.archives': []
    });
    const goodReport = await verifyStagedMigration(good, resultsFor([]), expectedKeys);
    expect(goodReport.auditChainValid).toBe(true);

    const badRecord = {
      id: 'bad-audit',
      timestamp: '2026-11-18T10:00:00.000Z',
      actorId: 'user-1',
      actorRole: 'Admin',
      action: 'UPDATE',
      entityType: 'shuttle',
      entityId: 'CS-01',
      previousHash: 'GENESIS',
      hash: 'not-a-valid-sha256'
    };
    const bad = contextWith({
      'operational.shuttles': [],
      'audit.active': [badRecord],
      'audit.archives': []
    });
    const badResults: AdapterResult[] = [
      { status: 'imported', key: 'operational.shuttles', value: [], recordsCount: 0 },
      { status: 'imported', key: 'audit.active', value: [badRecord], recordsCount: 1 },
      { status: 'imported', key: 'audit.archives', value: [], recordsCount: 0 }
    ];
    const badReport = await verifyStagedMigration(bad, badResults, expectedKeys);
    expect(badReport.auditChainValid).toBe(false);
    expect(badReport.valid).toBe(false);
  });

  it('accepts adapter-confirmed already-synced values and rejects a count mismatch', async () => {
    const context = contextWith({
      'operational.shuttles': [{ id: 'CS-01' }],
      'audit.active': [],
      'audit.archives': []
    });
    const alreadySynced: AdapterResult[] = [
      { status: 'already-synced', key: 'operational.shuttles', recordsCount: 1 },
      { status: 'already-synced', key: 'audit.active', recordsCount: 0 },
      { status: 'already-synced', key: 'audit.archives', recordsCount: 0 }
    ];
    expect((await verifyStagedMigration(context, alreadySynced, expectedKeys)).valid).toBe(true);

    const countMismatch = alreadySynced.map((item) =>
      item.key === 'operational.shuttles' ? { ...item, recordsCount: 2 } : item
    );
    expect((await verifyStagedMigration(context, countMismatch, expectedKeys)).valid).toBe(false);
  });
});
