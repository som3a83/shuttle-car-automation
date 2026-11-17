import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setBackendForTesting,
  get,
  getWithRevision,
  LegacyFallbackEngine,
  remove,
  set,
  type StorageKey
} from '../../index';
import {
  AUDIT_ARCHIVE_PENDING_LEGACY_KEY,
  EXCLUDED_SESSION_STORAGE_KEY,
  LEGACY_KEY_MAP
} from '../legacyKeyMap';
import { resolveLegacyKey } from '../legacyKeyResolver';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
}

const valuesByKey: Record<string, unknown> = {
  'operational.language': 'ar',
  'operational.theme': 'light',
  'operational.sidebarCollapsed': true,
  'operational.shuttles': [],
  'operational.batteries': [],
  'operational.faults': [],
  'operational.maintenance': [],
  'operational.connections': [],
  'operational.notifications': [],
  'operational.settings': {
    language: 'ar', theme: 'dark', notificationsEnabled: true,
    maintenanceReminders: true, batteryAlerts: true, communicationAlerts: false
  },
  'operational.dailyReports': [],
  'operational.shifts': [],
  'auth.accounts': [],
  'audit.active': [],
  'audit.archives': [],
  'customization.config': { modules: [], navigation: [], dashboard: [] },
  'customization.audit': []
};

const importableDefinitions = LEGACY_KEY_MAP.filter((entry) => entry.importable && entry.targetKey !== null);
let storage: MemoryStorage;

function setLegacyValue(legacyKey: string, value: unknown): void {
  storage.setItem(legacyKey, JSON.stringify(value));
}

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  __setBackendForTesting(new LegacyFallbackEngine());
});

afterEach(() => {
  __setBackendForTesting(null);
  vi.unstubAllGlobals();
});

describe('legacy key resolver and fallback engine', () => {
  it('RES-001 maps all 17 importable legacy keys from the single approved map', () => {
    expect(importableDefinitions).toHaveLength(17);
    for (const definition of importableDefinitions) {
      expect(resolveLegacyKey(definition.targetKey as StorageKey)).toEqual({
        legacyKey: definition.legacyKey,
        ...(definition.targetKey === 'operational.shuttles' ? { transform: expect.any(Function) } : {})
      });
    }
  });

  it('RES-002 reads all 17 existing legacy records through the unified get API', async () => {
    for (const definition of importableDefinitions) {
      const key = definition.targetKey as StorageKey;
      setLegacyValue(definition.legacyKey, valuesByKey[key]);
    }
    for (const definition of importableDefinitions) {
      const key = definition.targetKey as StorageKey;
      await expect(get(key)).resolves.toEqual(valuesByKey[key]);
    }
  });

  it('RES-003 writes all 17 records through set to their exact legacy keys', async () => {
    for (const definition of importableDefinitions) {
      const key = definition.targetKey as StorageKey;
      await set(key, valuesByKey[key] as never);
      expect(storage.getItem(definition.legacyKey)).not.toBeNull();
      expect(storage.getItem(key)).toBeNull();
    }
  });

  it('RES-004 round-trips through the unified API without changing JSON payloads on write', async () => {
    for (const definition of importableDefinitions) {
      const key = definition.targetKey as StorageKey;
      await set(key, valuesByKey[key] as never);
      await expect(get(key)).resolves.toEqual(valuesByKey[key]);
    }
  });

  it('RES-005 stores JSON.parse-compatible raw JSON equal to the exact set value', async () => {
    const input = [
      { id: 'SC-01', manufacturer: 'Cassioli', operatingHours: 0, operatingCycles: 0 },
      { id: 'SC-02', manufacturer: 'ACME', operatingHours: 5, operatingCycles: 12 }
    ];
    await set('operational.shuttles', input as never);
    const raw = storage.getItem('shuttle-car-automation-v7:shuttles');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual(input);
  });

  it('RES-006 preserves the revision sidecar contract and increments revisions', async () => {
    await set('operational.theme', 'dark');
    await expect(getWithRevision('operational.theme')).resolves.toEqual({ value: 'dark', revision: 1 });
    await set('operational.theme', 'light', 1);
    await expect(getWithRevision('operational.theme')).resolves.toEqual({ value: 'light', revision: 2 });
    expect(storage.getItem('shuttle.storage.revision.operational.theme')).toBe('2');
  });

  it('RES-007 rejects stale expected revisions without overwriting the legacy value', async () => {
    setLegacyValue('shuttle-car-automation-v7:theme', 'dark');
    await expect(set('operational.theme', 'light', 1)).rejects.toMatchObject({
      name: 'StorageError', code: 'STORAGE_CONFLICT', expectedRevision: 1, actualRevision: 0
    });
    expect(JSON.parse(storage.getItem('shuttle-car-automation-v7:theme') as string)).toBe('dark');
    await expect(set('operational.theme', 'light', 0)).resolves.toEqual({ revision: 1 });
  });

  it('RES-008 reports malformed JSON as corruption instead of treating it as an empty value', async () => {
    storage.setItem('shuttle-car-automation-v7:theme', '{broken-json');
    await expect(get('operational.theme')).rejects.toMatchObject({
      name: 'StorageError', code: 'STORAGE_CORRUPT'
    });
  });

  it('RES-009 returns null for unknown keys, session storage and the pending audit marker', async () => {
    expect(resolveLegacyKey('unmapped.key')).toBeNull();
    expect(resolveLegacyKey(EXCLUDED_SESSION_STORAGE_KEY)).toBeNull();
    expect(resolveLegacyKey(AUDIT_ARCHIVE_PENDING_LEGACY_KEY)).toBeNull();
    await expect(new LegacyFallbackEngine().read('unmapped.key' as StorageKey)).resolves.toBeNull();
  });

  it('RES-010 leaves verified snapshots, previous snapshots, session and pending marker untouched by ordinary writes', async () => {
    const primaryKey = 'shuttle-car-automation-v7:verified:shuttles';
    const previousKey = primaryKey + ':previous';
    storage.setItem(primaryKey, 'verified-primary-bytes');
    storage.setItem(previousKey, 'verified-previous-bytes');
    storage.setItem(AUDIT_ARCHIVE_PENDING_LEGACY_KEY, 'pending-archive-bytes');

    const sessionStorage = new MemoryStorage();
    sessionStorage.setItem(EXCLUDED_SESSION_STORAGE_KEY, 'session-bytes');
    vi.stubGlobal('sessionStorage', sessionStorage);

    await set('operational.shuttles', []);
    expect(storage.getItem(primaryKey)).toBe('verified-primary-bytes');
    expect(storage.getItem(previousKey)).toBe('verified-previous-bytes');
    expect(storage.getItem(AUDIT_ARCHIVE_PENDING_LEGACY_KEY)).toBe('pending-archive-bytes');
    expect(sessionStorage.getItem(EXCLUDED_SESSION_STORAGE_KEY)).toBe('session-bytes');
  });

  it('RES-011 removes both known representations and the revision sidecar without touching unrelated keys', async () => {
    setLegacyValue('shuttle-car-automation-v7:theme', 'dark');
    storage.setItem('shuttle.storage.revision.operational.theme', '4');
    storage.setItem('operational.theme', '"legacy-compat-value"');
    storage.setItem('operational.unrelated', 'unrelated-raw-value');

    await remove('operational.theme');

    expect(storage.getItem('shuttle-car-automation-v7:theme')).toBeNull();
    expect(storage.getItem('operational.theme')).toBeNull();
    expect(storage.getItem('shuttle.storage.revision.operational.theme')).toBeNull();
    expect(storage.getItem('operational.unrelated')).toBe('unrelated-raw-value');
  });

  it('RES-012 does not normalize account, audit or customization payloads in the resolver', async () => {
    const accountLike = [{ id: 'LOCAL-1', operatingHours: 0, operatingCycles: 0 }];
    const auditLike = [{ id: 'AUD-1', operatingHours: 0, operatingCycles: 0 }];
    const customizationLike = { modules: [], navigation: [], dashboard: [], operatingHours: 0 };

    setLegacyValue('shuttle-car-automation-v1:local-accounts', accountLike);
    setLegacyValue('shuttle-car-automation-v1:audit-log', auditLike);
    setLegacyValue('shuttle-car-automation-v1:audit-archives', auditLike);
    setLegacyValue('shuttle-car-automation-v7:customization', customizationLike);
    setLegacyValue('shuttle-car-automation-v7:customization-audit', auditLike);

    await expect(get('auth.accounts')).resolves.toEqual(accountLike);
    await expect(get('audit.active')).resolves.toEqual(auditLike);
    await expect(get('audit.archives')).resolves.toEqual(auditLike);
    await expect(get('customization.config')).resolves.toEqual(customizationLike);
    await expect(get('customization.audit')).resolves.toEqual(auditLike);
  });
});

describe('strict legacy shuttle placeholder normalization', () => {
  const marker = {
    model: 'Not recorded',
    serialNumber: 'Not recorded',
    connectivity: 'UNKNOWN',
    status: 'Unknown'
  };

  it('NORM-001 changes only zero hours and zero cycles on a record with all four legacy markers', async () => {
    setLegacyValue('shuttle-car-automation-v7:shuttles', [{
      id: 'SC-LEGACY-01', ...marker, operatingHours: 0, operatingCycles: 0
    }]);
    await expect(get('operational.shuttles')).resolves.toEqual([{
      id: 'SC-LEGACY-01', ...marker, operatingHours: null, operatingCycles: null
    }]);
  });

  it('NORM-002 preserves non-zero operating hours and cycles even when all four markers match', async () => {
    setLegacyValue('shuttle-car-automation-v7:shuttles', [{
      id: 'SC-LEGACY-02', ...marker, operatingHours: 5, operatingCycles: 7
    }]);
    await expect(get('operational.shuttles')).resolves.toEqual([{
      id: 'SC-LEGACY-02', ...marker, operatingHours: 5, operatingCycles: 7
    }]);
  });

  it('NORM-003 preserves zero hours and cycles when the four legacy markers do not all match', async () => {
    setLegacyValue('shuttle-car-automation-v7:shuttles', [{
      id: 'SC-REAL-ZERO', ...marker, model: 'Cassioli ISAT', operatingHours: 0, operatingCycles: 0
    }]);
    await expect(get('operational.shuttles')).resolves.toEqual([{
      id: 'SC-REAL-ZERO', ...marker, model: 'Cassioli ISAT', operatingHours: 0, operatingCycles: 0
    }]);
  });

  it('NORM-004 never normalizes zero values in batteries or faults', async () => {
    const batteries = [{ id: 'BAT-01', operatingHours: 0, operatingCycles: 0, soc: 0 }];
    const faults = [{ id: 'FLT-01', operatingHours: 0, operatingCycles: 0, duration: 0 }];
    setLegacyValue('shuttle-car-automation-v7:batteries', batteries);
    setLegacyValue('shuttle-car-automation-v7:faults', faults);
    await expect(get('operational.batteries')).resolves.toEqual(batteries);
    await expect(get('operational.faults')).resolves.toEqual(faults);
  });
});
