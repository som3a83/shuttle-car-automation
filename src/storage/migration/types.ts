import type { StorageKey, RevisionedValue, SetResult, StorageSchema, MigrationStorageContext } from '../index';

export enum MigrationState {
  IDLE = 'IDLE',
  PREFLIGHT = 'PREFLIGHT',
  LOCKED = 'LOCKED',
  STAGING = 'STAGING',
  VERIFYING = 'VERIFYING',
  READY_TO_COMMIT = 'READY_TO_COMMIT',
  COMMITTING = 'COMMITTING',
  COMMITTED_PENDING_MODE_SWITCH = 'COMMITTED_PENDING_MODE_SWITCH',
  COMPLETE = 'COMPLETE',
  FAILED = 'FAILED',
  RECOVERY_REQUIRED = 'RECOVERY_REQUIRED'
}

export type MigrationVerificationStatus = 'pending' | 'passed' | 'failed';
export interface MigrationJournal {
  migrationId: string;
  state: MigrationState;
  sourceFingerprint: string;
  expectedKeyCount: number;
  completedKeyCount: number;
  verificationStatus: MigrationVerificationStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
  stagingGeneration: string;
  ownerToken: string;
}
export interface MigrationContext extends MigrationStorageContext {
  readonly sourceFingerprint: string;
}
export interface MigrationResult {
  success: boolean;
  migrationId: string;
  state: MigrationState;
  completedKeyCount: number;
  expectedKeyCount: number;
  verificationStatus: MigrationVerificationStatus;
  error?: string;
}
export interface MigrationOptions {
  legacyStorage?: { getItem(key: string): string | null };
  migrationId?: string;
  expectedSourceFingerprint?: string;
  ownerToken?: string;
  lockExpiresAt?: number;
  now?: () => Date;
}
export type MigrationKeyValue = { [K in StorageKey]: StorageSchema[K] }[StorageKey];
export type MigrationRevision = RevisionedValue<unknown>;
export type MigrationWriteResult = SetResult;
