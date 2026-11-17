import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __closeForTesting,
  __resetStorageForTesting,
  getWithRevision,
  setStorageModePreference,
  type StorageKey
} from '../../index';
import {
  AUDIT_LEGACY_KEY_MAP,
  AUTH_LEGACY_KEY_MAP,
  CUSTOMIZATION_LEGACY_KEY_MAP,
  OPERATIONAL_LEGACY_KEY_MAP
} from '../legacyKeyMap';
import { importOperationalKey } from '../operationalAdapter';
import { importAuthData } from '../authAdapter';
import { importAuditData } from '../auditAdapter';
import { importCustomizationData } from '../customizationAdapter';
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

async function verifyRoundTrip(
  storageKey: StorageKey,
  sourceValue: unknown,
  result: { status: string; key: string }
): Promise<void> {
  expect(result).toMatchObject({ status: 'imported', key: storageKey });
  const stored = await getWithRevision(storageKey);
  expect(stored).not.toBeNull();
  expect(stored?.value).toEqual(sourceValue);
  expect(stored?.revision).toBe(1);
}

const operationalCases: Array<{ id: string; index: number; value: unknown }> = [
  { id: 'RT-001', index: 0, value: 'ar' },
  { id: 'RT-002', index: 1, value: 'light' },
  { id: 'RT-003', index: 2, value: true },
  { id: 'RT-004', index: 3, value: [{ id: 'SC-RT-004', exact: 'shuttle-source' }] },
  { id: 'RT-005', index: 4, value: [{ id: 'BAT-RT-005', exact: 'battery-source' }] },
  { id: 'RT-006', index: 5, value: [{ id: 'FLT-RT-006', exact: 'fault-source' }] },
  { id: 'RT-007', index: 6, value: [{ id: 'MNT-RT-007', exact: 'maintenance-source' }] },
  { id: 'RT-008', index: 7, value: [{ id: 'CON-RT-008', exact: 'connection-source' }] },
  { id: 'RT-009', index: 8, value: [{ id: 'NTF-RT-009', exact: 'notification-source' }] },
  {
    id: 'RT-010', index: 9, value: {
      language: 'en', theme: 'dark', notificationsEnabled: false,
      maintenanceReminders: true, batteryAlerts: false, communicationAlerts: true
    }
  },
  { id: 'RT-011', index: 10, value: [{ id: 'RPT-RT-011', exact: 'daily-report-source' }] },
  { id: 'RT-012', index: 11, value: [{ id: 'SHF-RT-012', exact: 'shift-source' }] }
];

describe('17-key adapter round-trip verification', () => {
  it.each(operationalCases)('$id preserves its operational source value and revision', async ({ index, value }) => {
    const definition = OPERATIONAL_LEGACY_KEY_MAP[index];
    localStorage.setItem(definition.legacyKey, JSON.stringify(value));
    const result = await importOperationalKey(definition.legacyKey);
    await verifyRoundTrip(definition.targetKey, value, result);
  });

  it('RT-013 preserves the auth.accounts source value and revision', async () => {
    const value: unknown[] = [];
    localStorage.setItem(AUTH_LEGACY_KEY_MAP.accounts.legacyKey, JSON.stringify(value));
    const result = await importAuthData(localStorage);
    await verifyRoundTrip('auth.accounts', value, result);
  });

  it('RT-014 preserves the audit.active source value and revision', async () => {
    const active: unknown[] = [];
    const archives: unknown[] = [];
    localStorage.setItem(AUDIT_LEGACY_KEY_MAP.active.legacyKey, JSON.stringify(active));
    localStorage.setItem(AUDIT_LEGACY_KEY_MAP.archives.legacyKey, JSON.stringify(archives));
    const results = await importAuditData(localStorage);
    const result = results.find((entry) => entry.key === 'audit.active');
    expect(result).toBeDefined();
    await verifyRoundTrip('audit.active', active, result!);
  });

  it('RT-015 preserves the audit.archives source value and revision', async () => {
    const active: unknown[] = [];
    const archives: unknown[] = [];
    localStorage.setItem(AUDIT_LEGACY_KEY_MAP.active.legacyKey, JSON.stringify(active));
    localStorage.setItem(AUDIT_LEGACY_KEY_MAP.archives.legacyKey, JSON.stringify(archives));
    const results = await importAuditData(localStorage);
    const result = results.find((entry) => entry.key === 'audit.archives');
    expect(result).toBeDefined();
    await verifyRoundTrip('audit.archives', archives, result!);
  });

  it('RT-016 preserves the customization.config source value and revision', async () => {
    localStorage.setItem(CUSTOMIZATION_LEGACY_KEY_MAP.config.legacyKey, JSON.stringify(DEFAULT_CUSTOMIZATION));
    localStorage.setItem(CUSTOMIZATION_LEGACY_KEY_MAP.audit.legacyKey, JSON.stringify([]));
    const results = await importCustomizationData(localStorage);
    const result = results.find((entry) => entry.key === 'customization.config');
    expect(result).toBeDefined();
    await verifyRoundTrip('customization.config', DEFAULT_CUSTOMIZATION, result!);
  });

  it('RT-017 preserves the customization.audit source value and revision', async () => {
    const audit: unknown[] = [];
    localStorage.setItem(CUSTOMIZATION_LEGACY_KEY_MAP.config.legacyKey, JSON.stringify(DEFAULT_CUSTOMIZATION));
    localStorage.setItem(CUSTOMIZATION_LEGACY_KEY_MAP.audit.legacyKey, JSON.stringify(audit));
    const results = await importCustomizationData(localStorage);
    const result = results.find((entry) => entry.key === 'customization.audit');
    expect(result).toBeDefined();
    await verifyRoundTrip('customization.audit', audit, result!);
  });
});
