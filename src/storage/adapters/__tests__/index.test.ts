import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __closeForTesting, __resetStorageForTesting, __setBackendForTesting, setStorageModePreference, STORAGE_MODE_KEY, get } from '../../index';
import { importAllLegacyData } from '../index';
import {
  AUTH_LEGACY_KEY_MAP,
  AUDIT_LEGACY_KEY_MAP,
  CUSTOMIZATION_LEGACY_KEY_MAP,
  OPERATIONAL_LEGACY_KEY_MAP
} from '../legacyKeyMap';
import { DEFAULT_CUSTOMIZATION } from '../../../data/applicationCustomization';

async function resetDatabase(): Promise<void> {
  __setBackendForTesting(null);
  __resetStorageForTesting();
  await __closeForTesting();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('shuttle-car-storage');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
  localStorage.clear();
  localStorage.removeItem(STORAGE_MODE_KEY);
  setStorageModePreference('auto');
}

beforeEach(async () => resetDatabase());
afterEach(async () => {
  await __closeForTesting();
  __resetStorageForTesting();
  localStorage.clear();
});

function populateAllLegacySources(): void {
  for (const entry of OPERATIONAL_LEGACY_KEY_MAP) {
    const collection = entry.legacyKey.split(':').pop();
    let value: unknown = [];
    if (collection === 'language') value = 'ar';
    else if (collection === 'theme') value = 'dark';
    else if (collection === 'sidebarCollapsed') value = false;
    else if (collection === 'settings') {
      value = {
        language: 'ar',
        theme: 'dark',
        notificationsEnabled: true,
        maintenanceReminders: true,
        batteryAlerts: true,
        communicationAlerts: true
      };
    }
    localStorage.setItem(entry.legacyKey, JSON.stringify(value));
  }
  localStorage.setItem(AUTH_LEGACY_KEY_MAP.accounts.legacyKey, JSON.stringify([]));
  localStorage.setItem(AUDIT_LEGACY_KEY_MAP.active.legacyKey, JSON.stringify([]));
  localStorage.setItem(AUDIT_LEGACY_KEY_MAP.archives.legacyKey, JSON.stringify([]));
  localStorage.setItem(CUSTOMIZATION_LEGACY_KEY_MAP.config.legacyKey, JSON.stringify(DEFAULT_CUSTOMIZATION));
  localStorage.setItem(CUSTOMIZATION_LEGACY_KEY_MAP.audit.legacyKey, JSON.stringify([]));
}

describe('adapter integration', () => {
  it('INT-015 imports all 17 approved legacy keys through the public entry point', async () => {
    populateAllLegacySources();
    const results = await importAllLegacyData();
    expect(results).toHaveLength(17);
    expect(results.every((result) => result.status === 'imported')).toBe(true);
  });

  it('INT-016 a second full import is idempotent across every adapter family', async () => {
    populateAllLegacySources();
    await importAllLegacyData();
    const results = await importAllLegacyData();
    expect(results).toHaveLength(17);
    expect(results.every((result) => result.status === 'already-synced')).toBe(true);
  });

  it('INT-017 reports a conflict without merging or replacing the existing logical value', async () => {
    populateAllLegacySources();
    await importAllLegacyData();
    localStorage.setItem(OPERATIONAL_LEGACY_KEY_MAP[0].legacyKey, JSON.stringify('en'));
    const results = await importAllLegacyData();
    expect(results[0].status).toBe('conflict');
    await expect(get('operational.language')).resolves.toBe('ar');
    expect(results.slice(1).every((result) => result.status === 'already-synced')).toBe(true);
  });
});
