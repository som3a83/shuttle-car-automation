import { describe, expect, it } from 'vitest';
import { MigrationState } from '../types';

describe('migration types', () => {
  it('exposes stable migration state names', () => {
    expect(MigrationState.IDLE).toBe('IDLE');
    expect(MigrationState.PREFLIGHT).toBe('PREFLIGHT');
    expect(MigrationState.LOCKED).toBe('LOCKED');
    expect(MigrationState.STAGING).toBe('STAGING');
    expect(MigrationState.VERIFYING).toBe('VERIFYING');
    expect(MigrationState.READY_TO_COMMIT).toBe('READY_TO_COMMIT');
    expect(MigrationState.COMMITTING).toBe('COMMITTING');
    expect(MigrationState.COMMITTED_PENDING_MODE_SWITCH).toBe('COMMITTED_PENDING_MODE_SWITCH');
    expect(MigrationState.COMPLETE).toBe('COMPLETE');
    expect(MigrationState.FAILED).toBe('FAILED');
    expect(MigrationState.RECOVERY_REQUIRED).toBe('RECOVERY_REQUIRED');
  });
});
