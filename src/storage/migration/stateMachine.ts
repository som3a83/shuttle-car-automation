import { MigrationState } from './types';

const ALLOWED: Record<MigrationState, readonly MigrationState[]> = {
  [MigrationState.IDLE]: [MigrationState.PREFLIGHT],
  [MigrationState.PREFLIGHT]: [MigrationState.LOCKED, MigrationState.FAILED],
  [MigrationState.LOCKED]: [MigrationState.STAGING, MigrationState.FAILED, MigrationState.RECOVERY_REQUIRED],
  [MigrationState.STAGING]: [MigrationState.VERIFYING, MigrationState.FAILED, MigrationState.RECOVERY_REQUIRED],
  [MigrationState.VERIFYING]: [MigrationState.READY_TO_COMMIT, MigrationState.FAILED, MigrationState.RECOVERY_REQUIRED],
  [MigrationState.READY_TO_COMMIT]: [MigrationState.COMMITTING, MigrationState.FAILED, MigrationState.RECOVERY_REQUIRED],
  [MigrationState.COMMITTING]: [MigrationState.COMMITTED_PENDING_MODE_SWITCH, MigrationState.FAILED, MigrationState.RECOVERY_REQUIRED],
  [MigrationState.COMMITTED_PENDING_MODE_SWITCH]: [MigrationState.COMPLETE, MigrationState.RECOVERY_REQUIRED],
  [MigrationState.COMPLETE]: [],
  [MigrationState.FAILED]: [],
  [MigrationState.RECOVERY_REQUIRED]: []
};

export function canTransition(from: MigrationState, to: MigrationState): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}
export function transition(from: MigrationState, to: MigrationState): MigrationState {
  if (!canTransition(from, to)) throw new Error(`Invalid migration transition: ${from} -> ${to}`);
  return to;
}
export function allowedTransitions(from: MigrationState): readonly MigrationState[] {
  return ALLOWED[from] ?? [];
}
