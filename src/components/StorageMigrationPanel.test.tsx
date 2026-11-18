import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StorageMigrationPanel from './StorageMigrationPanel';
import { getMode } from '../storage';
import { migrateToIndexedDb } from '../storage/migration';
import { createLegacyStorageBackup } from '../storage/migration/legacyBackup';

vi.mock('../storage', () => ({ getMode: vi.fn() }));
vi.mock('../storage/migration', () => ({ migrateToIndexedDb: vi.fn() }));
vi.mock('../storage/migration/legacyBackup', () => ({ createLegacyStorageBackup: vi.fn() }));

const mockGetMode = vi.mocked(getMode);
const mockMigration = vi.mocked(migrateToIndexedDb);
const mockBackup = vi.mocked(createLegacyStorageBackup);

const backupFixture = {
  format: 'shuttle-legacy-storage-backup' as const,
  schemaVersion: 1 as const,
  exportedAt: '2026-11-18T12:00:00.000Z',
  source: 'window.localStorage' as const,
  recordCount: 17,
  records: [],
  sha256: 'a'.repeat(64)
};

async function confirmBackup(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /Create complete local data backup/i }));
  fireEvent.click(await screen.findByRole('checkbox', { name: /saved the downloaded backup file/i }));
}

describe('StorageMigrationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMode.mockResolvedValue('legacy-fallback');
    mockBackup.mockResolvedValue(backupFixture);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:verified-backup') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  });

  it('flushes pending application writes before creating the complete SHA-256 backup', async () => {
    const beforeBackup = vi.fn().mockResolvedValue(undefined);
    render(<StorageMigrationPanel language="en" beforeBackup={beforeBackup} />);
    const migrate = await screen.findByRole('button', { name: /Migrate records to IndexedDB/i });
    expect(migrate).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Create complete local data backup/i }));
    expect(await screen.findByText(/Backup file created/i)).toBeInTheDocument();
    expect(screen.getByText(/17 localStorage keys/i)).toBeInTheDocument();
    expect(mockBackup).toHaveBeenCalledTimes(1);
    expect(beforeBackup).toHaveBeenCalledTimes(1);
    expect(beforeBackup.mock.invocationCallOrder[0]).toBeLessThan(mockBackup.mock.invocationCallOrder[0]);
    expect(migrate).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /saved the downloaded backup file/i }));
    expect(migrate).toBeEnabled();
  });

  it('locks the application while migrating and requests a reload after verified completion', async () => {
    const onLockChange = vi.fn();
    const onMigrationComplete = vi.fn();
    mockMigration.mockResolvedValue({
      success: true,
      migrationId: 'test-migration',
      state: 'COMPLETE' as never,
      completedKeyCount: 17,
      expectedKeyCount: 17,
      verificationStatus: 'passed'
    });
    render(<StorageMigrationPanel language="en" onLockChange={onLockChange} onMigrationComplete={onMigrationComplete} />);
    await confirmBackup();
    fireEvent.click(screen.getByRole('button', { name: /Migrate records to IndexedDB/i }));

    expect(onLockChange).toHaveBeenCalledWith(true);
    expect(await screen.findByText(/Migration and verification completed successfully/i)).toBeInTheDocument();
    expect(onMigrationComplete).toHaveBeenCalledTimes(1);
    expect(onLockChange).toHaveBeenCalledTimes(1);
  });

  it('unlocks the application and displays the error when migration does not complete', async () => {
    const onLockChange = vi.fn();
    mockMigration.mockResolvedValue({
      success: false,
      migrationId: 'test-migration',
      state: 'RECOVERY_REQUIRED' as never,
      completedKeyCount: 4,
      expectedKeyCount: 17,
      verificationStatus: 'failed',
      error: 'Source fingerprint changed during migration.'
    });
    render(<StorageMigrationPanel language="en" onLockChange={onLockChange} />);
    await confirmBackup();
    fireEvent.click(screen.getByRole('button', { name: /Migrate records to IndexedDB/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Source fingerprint changed/);
    await waitFor(() => expect(onLockChange).toHaveBeenLastCalledWith(false));
  });

  it('does not offer another migration when IndexedDB is already active', async () => {
    mockGetMode.mockResolvedValue('indexeddb');
    render(<StorageMigrationPanel language="ar" />);
    expect(await screen.findByText(/IndexedDB/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Migrate records/i })).not.toBeInTheDocument();
  });

  it('does not allow migration when a full backup fails', async () => {
    mockBackup.mockRejectedValue(new Error('Web Crypto SHA-256 is unavailable.'));
    render(<StorageMigrationPanel language="en" />);
    fireEvent.click(await screen.findByRole('button', { name: /Create complete local data backup/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Web Crypto SHA-256 is unavailable/);
    expect(screen.getByRole('button', { name: /Migrate records to IndexedDB/i })).toBeDisabled();
  });
});
