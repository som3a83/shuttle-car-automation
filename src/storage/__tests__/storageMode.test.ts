import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  __closeForTesting,
  __resetStorageForTesting,
  getMode,
  getStorageModePreference,
  setStorageModePreference,
  STORAGE_MODE_KEY
} from '../index';

afterEach(async () => {
  await __closeForTesting();
  __resetStorageForTesting();
  localStorage.removeItem(STORAGE_MODE_KEY);
});

describe('2B-3c storage mode preference', () => {
  it('defaults to legacy when the preference is missing', () => {
    expect(getStorageModePreference()).toBe('legacy');
  });

  it('defaults to legacy for an invalid stored preference', () => {
    localStorage.setItem(STORAGE_MODE_KEY, 'unknown');
    expect(getStorageModePreference()).toBe('legacy');
  });

  it('persists a valid preference', () => {
    setStorageModePreference('auto');
    expect(localStorage.getItem(STORAGE_MODE_KEY)).toBe('auto');
    expect(getStorageModePreference()).toBe('auto');
  });

  it('legacy mode always selects LegacyFallbackEngine even when IndexedDB exists', async () => {
    setStorageModePreference('legacy');
    expect(await getMode()).toBe('legacy-fallback');
  });

  it('indexeddb mode selects IndexedDbEngine when available', async () => {
    setStorageModePreference('indexeddb');
    expect(await getMode()).toBe('indexeddb');
  });

  it('auto mode preserves IndexedDB-first behavior', async () => {
    setStorageModePreference('auto');
    expect(await getMode()).toBe('indexeddb');
  });

  it('keeps the selected preference fixed for the current session', async () => {
    setStorageModePreference('legacy');
    expect(await getMode()).toBe('legacy-fallback');
    setStorageModePreference('indexeddb');
    expect(getStorageModePreference()).toBe('legacy');
    expect(await getMode()).toBe('legacy-fallback');
  });
});
