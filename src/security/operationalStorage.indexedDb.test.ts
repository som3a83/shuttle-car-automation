import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __closeForTesting, __resetStorageForTesting, set, setStorageModePreference } from '../storage';
import { bootstrapOperationalStorage, OPERATIONAL_PREFIX } from './operationalStorage';

const values = [
  ['operational.language', 'ar'],
  ['operational.theme', 'dark'],
  ['operational.sidebarCollapsed', false],
  ['operational.shuttles', []],
  ['operational.batteries', []],
  ['operational.faults', []],
  ['operational.maintenance', []],
  ['operational.connections', []],
  ['operational.notifications', []],
  ['operational.settings', { language: 'ar', theme: 'dark', notificationsEnabled: true, maintenanceReminders: true, batteryAlerts: true, communicationAlerts: true }],
  ['operational.dailyReports', []],
  ['operational.shifts', []]
] as const;

async function clearDatabase(): Promise<void> {
  await __closeForTesting();
  __resetStorageForTesting();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('shuttle-car-storage');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
  localStorage.clear();
  __resetStorageForTesting();
}

beforeEach(async () => {
  await clearDatabase();
  setStorageModePreference('indexeddb');
});
afterEach(async () => clearDatabase());

describe('operational bootstrap with active IndexedDB', () => {
  it('uses the migrated IndexedDB collections and ignores retained legacy source values', async () => {
    for (const [key, value] of values) await set(key, value as never);
    const staleLegacy = JSON.stringify([{ id: 'LEGACY-STALE' }]);
    localStorage.setItem(OPERATIONAL_PREFIX + 'shuttles', staleLegacy);

    const result = await bootstrapOperationalStorage();

    expect(result).toEqual({ status: 'ready', issues: [] });
    expect(localStorage.getItem(OPERATIONAL_PREFIX + 'shuttles')).toBe(staleLegacy);
  });

  it('pauses startup when an active IndexedDB generation is incomplete and preserves the legacy source', async () => {
    await set('operational.language', 'ar');
    const legacy = JSON.stringify([{ id: 'SC-LEGACY' }]);
    localStorage.setItem(OPERATIONAL_PREFIX + 'shuttles', legacy);

    await expect(bootstrapOperationalStorage()).rejects.toThrow(/IndexedDB is selected.*shuttles/i);
    expect(localStorage.getItem(OPERATIONAL_PREFIX + 'shuttles')).toBe(legacy);
  });
});
