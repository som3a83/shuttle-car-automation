import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __closeForTesting, __resetStorageForTesting, __setBackendForTesting, setStorageModePreference, STORAGE_MODE_KEY, get } from '../../index';
import { CUSTOMIZATION_LEGACY_KEY_MAP } from '../legacyKeyMap';
import { importCustomizationData } from '../customizationAdapter';
import { DEFAULT_CUSTOMIZATION, validateCustomization } from '../../../data/applicationCustomization';

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

describe('customization adapter', () => {
  it('CUS-013 imports normalized module, navigation and dashboard preferences', async () => {
    const source = { modules: [], navigation: [], dashboard: [] };
    localStorage.setItem(CUSTOMIZATION_LEGACY_KEY_MAP.config.legacyKey, JSON.stringify(source));
    localStorage.setItem(CUSTOMIZATION_LEGACY_KEY_MAP.audit.legacyKey, JSON.stringify([]));
    const results = await importCustomizationData();
    expect(results[0].status).toBe('imported');
    await expect(get('customization.config')).resolves.toEqual(validateCustomization(source));
    expect(await get('customization.config')).toEqual(DEFAULT_CUSTOMIZATION);
  });

  it('CUS-014 returns invalid-source for malformed customization audit entries', async () => {
    localStorage.setItem(CUSTOMIZATION_LEGACY_KEY_MAP.config.legacyKey, JSON.stringify(DEFAULT_CUSTOMIZATION));
    localStorage.setItem(CUSTOMIZATION_LEGACY_KEY_MAP.audit.legacyKey, JSON.stringify([{ id: 'bad' }]));
    const results = await importCustomizationData();
    expect(results[0].status).toBe('imported');
    expect(results[1].status).toBe('invalid-source');
    await expect(get('customization.audit')).resolves.toBeNull();
  });
});
