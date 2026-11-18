export { migrateToIndexedDb, MIGRATION_KEY_ORDER } from './orchestrator';
export {
  acquireMigrationLock,
  closeMigrationDatabaseForTesting,
  createStagingGeneration,
  getActiveGeneration,
  getGenerationRecordCount,
  getMigrationJournal,
  isGenerationEmpty,
  isMigrationGenerationActive,
  listPendingMigrationJournals,
  releaseMigrationLock,
  renewMigrationLock,
  saveMigrationJournal,
  switchActiveGeneration,
  type GenerationSnapshot,
  type JournalRecord,
  type MigrationLockRecord,
  type PointerSwitchOptions
} from './generation';
export {
  canonicalJson,
  countMigrationRecords,
  sha256Canonical,
  verifyStagedMigration,
  type KeyVerification,
  type MigrationVerificationReport
} from './verification';
export { MigrationState } from './types';
export type {
  MigrationJournal,
  MigrationOptions,
  MigrationResult,
  MigrationVerificationStatus
} from './types';
export type { MigrationStorageContext } from '../index';
