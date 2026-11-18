import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __closeForTesting,
  __resetStorageForTesting,
  get,
  getMode,
  getStorageEngine,
  set,
  setStorageModePreference
} from '../index';
import { listLocalAccountsAsync } from '../../security/localAuth';
import { verifyAuditLedgerAsync } from '../../security/auditLog';
import { DEFAULT_CUSTOMIZATION, loadCustomizationAsync, saveCustomizationAsync } from '../../data/applicationCustomization';

async function deleteDatabase(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('shuttle-car-storage');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

describe('shared configured storage backend', { timeout: 20000 }, () => {
  beforeEach(async () => {
    await __closeForTesting();
    __resetStorageForTesting();
    localStorage.clear();
    sessionStorage.clear();
    await deleteDatabase();
    setStorageModePreference('indexeddb');
  });

  afterEach(async () => {
    await __closeForTesting();
    __resetStorageForTesting();
  });

  it('routes operational, identity, audit and customization APIs through one IndexedDB engine', async () => {
    const engine = await getStorageEngine();
    expect(await engine.getMode()).toBe('indexeddb');
    expect(await getMode()).toBe('indexeddb');

    await set('auth.accounts', []);
    await set('audit.active', []);
    await set('audit.archives', []);
    await set('customization.config', DEFAULT_CUSTOMIZATION);
    await set('operational.language', 'ar');

    expect(await listLocalAccountsAsync()).toEqual([]);
    expect((await verifyAuditLedgerAsync()).valid).toBe(true);
    await saveCustomizationAsync(DEFAULT_CUSTOMIZATION);
    expect(await loadCustomizationAsync()).toEqual(DEFAULT_CUSTOMIZATION);

    expect(await get('auth.accounts')).toEqual([]);
    expect(await get('audit.active')).toEqual([]);
    expect(await get('customization.config')).toEqual(DEFAULT_CUSTOMIZATION);
    expect(await get('operational.language')).toBe('ar');
  });
});
