import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import StorageMigrationPanel from './StorageMigrationPanel';
import { getMode, getStorageModePreference } from '../storage';

const mocks = vi.hoisted(() => ({ migrate: vi.fn() }));
vi.mock('../storage/migration', () => ({ migrateToIndexedDb: (...args: unknown[]) => mocks.migrate(...args) }));
vi.mock('../storage', () => ({ getMode: vi.fn(), getStorageModePreference: vi.fn() }));

describe('StorageMigrationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getMode).mockResolvedValue('legacy-fallback');
    vi.mocked(getStorageModePreference).mockReturnValue('legacy');
  });
  afterEach(() => vi.restoreAllMocks());

  it('does not begin migration until the Super Admin explicitly starts it', async () => {
    render(<StorageMigrationPanel language="en" canMigrate />);
    const button = await screen.findByRole('button', { name: /Verify and migrate 17 records/i });
    expect(button).toBeEnabled();
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it('shows verified record progress and requires a deliberate reload after success', async () => {
    mocks.migrate.mockResolvedValue({ success: true, state: 'COMPLETE', completedKeyCount: 17, expectedKeyCount: 17 });
    render(<StorageMigrationPanel language="en" canMigrate />);
    fireEvent.click(await screen.findByRole('button', { name: /Verify and migrate 17 records/i }));
    expect(await screen.findByRole('button', { name: /Reload and activate IndexedDB/i })).toBeInTheDocument();
    expect(screen.getByText(/17\/17 records/i)).toBeInTheDocument();
    expect(mocks.migrate).toHaveBeenCalledTimes(1);
  });

  it('keeps migration unavailable to non-admin users', async () => {
    render(<StorageMigrationPanel language="en" canMigrate={false} />);
    expect(await screen.findByText(/Sign in as the Super Admin/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Verify and migrate 17 records/i })).toBeDisabled();
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it('reports failed migration without offering activation', async () => {
    mocks.migrate.mockResolvedValue({ success: false, state: 'FAILED', completedKeyCount: 12, expectedKeyCount: 17, error: 'Invalid account registry.' });
    render(<StorageMigrationPanel language="en" canMigrate />);
    fireEvent.click(await screen.findByRole('button', { name: /Verify and migrate 17 records/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid account registry.');
    expect(screen.queryByRole('button', { name: /Reload and activate IndexedDB/i })).not.toBeInTheDocument();
  });
});
