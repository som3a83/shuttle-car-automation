import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __closeForTesting, __resetStorageForTesting, set, setStorageModePreference } from '../storage';
import { bootstrapOperationalStorage, OPERATIONAL_PREFIX } from './operationalStorage';
import { initialShuttles } from '../data/mockData';

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
  ['operational.shifts', []],
  ['auth.accounts', []],
  ['audit.active', []],
  ['audit.archives', []],
  ['customization.config', {}],
  ['customization.audit', []]
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

  it('pauses startup when an operational collection is missing and preserves the legacy source', async () => {
    await set('operational.language', 'ar');
    const legacy = JSON.stringify([{ id: 'SC-LEGACY' }]);
    localStorage.setItem(OPERATIONAL_PREFIX + 'shuttles', legacy);

    await expect(bootstrapOperationalStorage()).rejects.toThrow(/IndexedDB is selected.*shuttles/i);
    expect(localStorage.getItem(OPERATIONAL_PREFIX + 'shuttles')).toBe(legacy);
  });

  it('also pauses startup when an identity, audit or customization record is missing', async () => {
    for (const [key, value] of values) {
      if (key !== 'audit.active') await set(key, value as never);
    }
    const legacyAccounts = JSON.stringify([{ id: 'LOCAL-ADMIN' }]);
    localStorage.setItem('shuttle-car-automation-v1:local-accounts', legacyAccounts);

    await expect(bootstrapOperationalStorage()).rejects.toThrow(/audit\.active/i);
    expect(localStorage.getItem('shuttle-car-automation-v1:local-accounts')).toBe(legacyAccounts);
  });
  
  it('verifies operational writes in IndexedDB without creating a duplicate localStorage snapshot', async () => {
    const shuttles = [{ ...initialShuttles[0], id: 'SC-IDB-01' }];
    await set('operational.shuttles', shuttles);
    const result = await (await import('./operationalStorage')).persistOperationalSnapshot('shuttles', shuttles);

    expect(result.revision).toBe(1);
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(localStorage.getItem(OPERATIONAL_PREFIX + 'verified:shuttles')).toBeNull();
    expect(localStorage.getItem(OPERATIONAL_PREFIX + 'verified:shuttles:previous')).toBeNull();
  });

  it('rejects operational save verification when IndexedDB differs from the requested state', async () => {
    await set('operational.shuttles', [{ ...initialShuttles[0], id: 'SC-IDB-01' }]);
    await expect(
      (await import('./operationalStorage')).persistOperationalSnapshot('shuttles', [{ ...initialShuttles[0], id: 'SC-IDB-02' }])
    ).rejects.toThrow(/does not match the latest application state/i);
  });

});
