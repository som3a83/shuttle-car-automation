import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StorageMigrationRollbackPanel from './StorageMigrationRollbackPanel';

const mocks = vi.hoisted(() => ({
  backup: vi.fn(),
  assess: vi.fn(),
  rollback: vi.fn(),
  sha256: vi.fn()
}));

vi.mock('../storage', () => ({ backup: mocks.backup }));
vi.mock('../storage/migration', () => ({
  assessMigrationRollback: mocks.assess,
  rollbackToLegacyStorage: mocks.rollback,
  sha256Canonical: mocks.sha256
}));

const eligibleAssessment = {
  eligible: true,
  reason: null,
  storageMode: 'indexeddb',
  activeGeneration: 'generation-migration-ui',
  snapshot: {
    id: 'migration-snapshot-ui',
    migrationId: 'ui-migration',
    previousGeneration: 'generation-1',
    nextGeneration: 'generation-migration-ui',
    sourceFingerprint: '1234567890abcdef1234567890abcdef',
    createdAt: '2026-11-18T10:00:00.000Z',
    keyCount: 17,
    recordRevisions: { 'operational.language': 1 }
  }
};

describe('StorageMigrationRollbackPanel', () => {
  beforeEach(() => {
    mocks.backup.mockReset().mockResolvedValue({
      format: 'shuttle-storage-backup',
      schemaVersion: 1,
      createdAt: '2026-11-18T10:00:00.000Z',
      records: {},
      checksum: 'local-checksum'
    });
    mocks.assess.mockReset().mockResolvedValue(eligibleAssessment);
    mocks.rollback.mockReset().mockResolvedValue({
      snapshot: { ...eligibleAssessment.snapshot, rolledBackAt: '2026-11-18T11:00:00.000Z' },
      rollbackGeneration: 'generation-rollback-ui'
    });
    mocks.sha256.mockReset().mockResolvedValue('a'.repeat(64));
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:test'),
      revokeObjectURL: vi.fn()
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not render the rollback control for a role without permission', () => {
    const { container } = render(<StorageMigrationRollbackPanel language="en" canRollback={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('requires a downloaded safety backup and explicit confirmation before rollback', async () => {
    const beforeRollback = vi.fn().mockResolvedValue(undefined);
    render(<StorageMigrationRollbackPanel language="en" canRollback beforeRollback={beforeRollback} />);

    await waitFor(() => expect(screen.getByText(/Preflight passed/i)).toBeInTheDocument());
    const execute = screen.getByRole('button', { name: /Confirm rollback to legacy storage/i });
    expect(execute).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Download IndexedDB safety backup/i }));
    await waitFor(() => expect(screen.getByRole('checkbox')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('checkbox'));
    expect(execute).toBeEnabled();
    fireEvent.click(execute);

    await waitFor(() => expect(mocks.rollback).toHaveBeenCalledTimes(1));
    expect(beforeRollback).toHaveBeenCalled();
    expect(screen.getByText(/Rollback committed successfully/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reload application now/i })).toBeInTheDocument();
  });

  it('shows a blocked reason when the migration is not eligible for rollback', async () => {
    mocks.assess.mockResolvedValue({
      eligible: false,
      reason: 'IndexedDB records have changed since migration.',
      storageMode: 'indexeddb',
      activeGeneration: 'generation-updated',
      snapshot: null
    });

    render(<StorageMigrationRollbackPanel language="en" canRollback />);
    await waitFor(() => expect(screen.getByText(/records have changed since migration/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Download IndexedDB safety backup/i })).toBeDisabled();
  });
});
