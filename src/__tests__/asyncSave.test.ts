import { describe, expect, it } from 'vitest';
import { OPERATIONAL_PREFIX, persistOperationalSnapshot } from '../security/operationalStorage';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, String(value)); }
}

describe('2B-3c asynchronous operational saves', () => {
  it('persists a verified snapshot and returns its revision/checksum', async () => {
    const storage = new MemoryStorage();
    const result = await persistOperationalSnapshot('language', 'ar', storage);
    expect(result.revision).toBe(1);
    expect(result.checksum).toMatch(/^[a-f0-9]{8}$/);
    expect(storage.getItem(`${OPERATIONAL_PREFIX}verified:language`)).not.toBeNull();
  });

  it('propagates storage write failures instead of silently succeeding', async () => {
    const storage = new MemoryStorage();
    storage.setItem = () => { throw new Error('quota unavailable'); };
    await expect(persistOperationalSnapshot('language', 'ar', storage)).rejects.toThrow();
  });
});
