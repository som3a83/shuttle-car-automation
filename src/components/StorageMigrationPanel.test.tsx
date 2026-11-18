import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StorageMigrationPanel from './StorageMigrationPanel';
import { getMode } from '../storage';
import { migrateToIndexedDb } from '../storage/migration';

vi.mock('../storage', () => ({ getMode: vi.fn() }));
vi.mock('../storage/migration', () => ({ migrateToIndexedDb: vi.fn() }));

const mockGetMode = vi.mocked(getMode);
const mockMigration = vi.mocked(migrateToIndexedDb);

describe('StorageMigrationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMode.mockResolvedValue('legacy-fallback');
  });

  it('requires a backup confirmation before starting the migration', async () => {
    const onLockChange = vi.fn();
    render(<StorageMigrationPanel language="en" onLockChange={onLockChange} />);
    const migrate = await screen.findByRole('button', { name: /Migrate records to IndexedDB/i });
    expect(migrate).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /created a backup/i }));
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
    fireEvent.click(await screen.findByRole('checkbox', { name: /created a backup/i }));
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
    fireEvent.click(await screen.findByRole('checkbox', { name: /created a backup/i }));
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
});
