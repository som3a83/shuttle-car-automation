import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __closeForTesting,
  __resetStorageForTesting,
  get,
  setStorageModePreference
} from '../../index';
import { importAllLegacyData } from '../index';
import { DEFAULT_CUSTOMIZATION } from '../../../data/applicationCustomization';

async function resetDatabase(): Promise<void> {
  __resetStorageForTesting();
  await __closeForTesting();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('shuttle-car-storage');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
  localStorage.clear();
  setStorageModePreference('auto');
}

beforeEach(async () => resetDatabase());
afterEach(async () => {
  await __closeForTesting();
  __resetStorageForTesting();
  localStorage.clear();
});

describe('missing legacy key defaults', () => {
  it('imports approved defaults for all 17 absent legacy keys and records the default note', async () => {
    const results = await importAllLegacyData(localStorage);
    expect(results).toHaveLength(17);
    for (const result of results) {
      expect(result.status).toBe('imported');
      if (result.status === 'imported') expect(result.note).toBe('default value used');
    }

    const expected: Array<[string, unknown]> = [
      ['operational.language', 'en'],
      ['operational.theme', 'light'],
      ['operational.sidebarCollapsed', false],
      ['operational.shuttles', []],
      ['operational.batteries', []],
      ['operational.faults', []],
      ['operational.maintenance', []],
      ['operational.connections', []],
      ['operational.notifications', []],
      ['operational.settings', {
        language: 'en',
        theme: 'light',
        notificationsEnabled: true,
        maintenanceReminders: true,
        batteryAlerts: true,
        communicationAlerts: true
      }],
      ['operational.dailyReports', []],
      ['operational.shifts', []],
      ['auth.accounts', []],
      ['audit.active', []],
      ['audit.archives', []],
      ['customization.config', DEFAULT_CUSTOMIZATION],
      ['customization.audit', []]
    ];

    for (const [key, value] of expected) {
      await expect(get(key as never)).resolves.toEqual(value);
    }
  });
});
