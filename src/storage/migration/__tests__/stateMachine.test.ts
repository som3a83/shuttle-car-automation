import { describe, expect, it } from 'vitest';
import { MigrationState } from '../types';
import { allowedTransitions, canTransition, transition } from '../stateMachine';

describe('migration state machine', () => {
  it('accepts each documented forward transition', () => {
    const path = [MigrationState.IDLE, MigrationState.PREFLIGHT, MigrationState.LOCKED,
      MigrationState.STAGING, MigrationState.VERIFYING, MigrationState.READY_TO_COMMIT,
      MigrationState.COMMITTING, MigrationState.COMMITTED_PENDING_MODE_SWITCH, MigrationState.COMPLETE];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
      expect(transition(path[i], path[i + 1])).toBe(path[i + 1]);
    }
  });
  it('allows failures before commit and recovery-required transitions', () => {
    expect(canTransition(MigrationState.PREFLIGHT, MigrationState.FAILED)).toBe(true);
    expect(canTransition(MigrationState.STAGING, MigrationState.RECOVERY_REQUIRED)).toBe(true);
    expect(canTransition(MigrationState.COMMITTING, MigrationState.RECOVERY_REQUIRED)).toBe(true);
  });
  it('rejects illegal transitions and terminal-state movement', () => {
    expect(canTransition(MigrationState.IDLE, MigrationState.STAGING)).toBe(false);
    expect(canTransition(MigrationState.COMPLETE, MigrationState.PREFLIGHT)).toBe(false);
    expect(canTransition(MigrationState.FAILED, MigrationState.LOCKED)).toBe(false);
    expect(() => transition(MigrationState.IDLE, MigrationState.COMPLETE)).toThrow(/Invalid migration transition/);
    expect(allowedTransitions(MigrationState.COMPLETE)).toEqual([]);
  });
});
