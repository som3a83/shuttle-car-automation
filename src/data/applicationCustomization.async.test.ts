import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendCustomizationAuditAsync,
  DEFAULT_CUSTOMIZATION,
  loadCustomizationAsync,
  readCustomizationAuditAsync,
  saveCustomizationAsync,
  validateCustomization
} from './applicationCustomization.ts';
import { LegacyFallbackEngine, StorageError } from '../storage/index.ts';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
  removeItem(key: string): void { this.values.delete(key); }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('async application customization backend', () => {
  it('loads defaults, saves normalized preferences, and keeps the validator synchronous', async () => {
    const defaults = await loadCustomizationAsync();
    expect(defaults).toEqual(DEFAULT_CUSTOMIZATION);

    const candidate = {
      ...defaults,
      modules: defaults.modules.map((module) => module.id === 'ai'
        ? { ...module, enabled: false }
        : module)
    };
    const normalized = validateCustomization(candidate);
    expect(normalized.modules.find((module) => module.id === 'ai')?.enabled).toBe(false);

    await saveCustomizationAsync(candidate);
    expect(JSON.parse(storage.getItem('shuttle-car-automation-v7:customization') || 'null')).toEqual(normalized);
    expect(await loadCustomizationAsync()).toEqual(normalized);
  });

  it('appends and reads customization audit records with the 500-entry limit', async () => {
    const first = await appendCustomizationAuditAsync({
      action: 'ASYNC_CUSTOMIZATION_TEST',
      target: 'module:ai',
      detail: 'Async audit entry'
    }, new Date('2026-11-17T12:00:00.000Z'));
    expect(first.action).toBe('ASYNC_CUSTOMIZATION_TEST');
    expect((await readCustomizationAuditAsync()).map((entry) => entry.id)).toEqual([first.id]);
    expect(JSON.parse(storage.getItem('shuttle-car-automation-v7:customization-audit') || '[]')).toHaveLength(1);
  });

  it('retries an audit revision conflict and keeps the new entry', async () => {
    const originalWrite = LegacyFallbackEngine.prototype.write;
    let conflicts = 0;
    LegacyFallbackEngine.prototype.write = async function(key, value, revision) {
      if (key === 'customization.audit' && conflicts === 0) {
        conflicts += 1;
        throw new StorageError({
          code: 'STORAGE_CONFLICT',
          message: 'Simulated concurrent customization audit write.',
          key,
          expectedRevision: revision,
          actualRevision: (revision ?? 0) + 1
        });
      }
      return originalWrite.call(this, key, value, revision);
    };

    try {
      const created = await appendCustomizationAuditAsync({
        action: 'ASYNC_RETRY_TEST',
        target: 'module:reports',
        detail: 'Retry after conflict'
      });
      expect(conflicts).toBe(1);
      expect((await readCustomizationAuditAsync()).map((entry) => entry.id)).toContain(created.id);
    } finally {
      LegacyFallbackEngine.prototype.write = originalWrite;
    }
  });
});
