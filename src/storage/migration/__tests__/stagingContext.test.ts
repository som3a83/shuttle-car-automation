import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { __closeForTesting, __resetStorageForTesting, createStagingContext, getWithRevision } from '../../index';

afterEach(async () => {
  await __closeForTesting();
  __resetStorageForTesting();
});

describe('staging context isolation', () => {
  it('writes to the named staging generation without changing active reads', async () => {
    const context = createStagingContext('migration-test-generation', 'migration-test');
    const value: import('../../../types').Shuttle[] = [];
    await context.set('operational.shuttles', value, 0);
    expect(await context.get('operational.shuttles')).toEqual(value);
    expect(await context.getWithRevision('operational.shuttles')).toEqual({ value, revision: 1 });
    expect(await getWithRevision('operational.shuttles')).toBeNull();
  });
  it('rejects invalid generation identifiers', () => {
    expect(() => createStagingContext('../active')).toThrow(/generation identifier/);
  });
});
