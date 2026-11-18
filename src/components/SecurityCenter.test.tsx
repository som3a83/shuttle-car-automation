import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import SecurityCenter from './SecurityCenter';

const mocks = vi.hoisted(() => ({
  listLocalAccountsAsync: vi.fn(),
  localAccountRegistryErrorAsync: vi.fn(),
  verifyAuditLedgerAsync: vi.fn(),
  readAllAuditRecordsAsync: vi.fn(),
  readAuditArchivesAsync: vi.fn(),
  appendAuditRecordAsync: vi.fn(),
  archiveAuditRecordsAsync: vi.fn(),
  authenticateLocalAccountAsync: vi.fn(),
  createLocalAccountAsync: vi.fn(),
  endLocalSession: vi.fn(),
  updateLocalAccountAsync: vi.fn(),
  setLocalAccountDisabledAsync: vi.fn(),
  changeLocalAccountPasswordAsync: vi.fn(),
  generateTemporaryPassword: vi.fn()
}));

vi.mock('../security/localAuth', () => ({
  authenticateLocalAccountAsync: mocks.authenticateLocalAccountAsync,
  createLocalAccountAsync: mocks.createLocalAccountAsync,
  endLocalSession: mocks.endLocalSession,
  listLocalAccountsAsync: mocks.listLocalAccountsAsync,
  localAccountRegistryErrorAsync: mocks.localAccountRegistryErrorAsync,
  updateLocalAccountAsync: mocks.updateLocalAccountAsync,
  setLocalAccountDisabledAsync: mocks.setLocalAccountDisabledAsync,
  changeLocalAccountPasswordAsync: mocks.changeLocalAccountPasswordAsync,
  generateTemporaryPassword: mocks.generateTemporaryPassword
}));

vi.mock('../security/auditLog', () => ({
  appendAuditRecordAsync: mocks.appendAuditRecordAsync,
  archiveAuditRecordsAsync: mocks.archiveAuditRecordsAsync,
  auditRecordsToCsv: vi.fn(() => ''),
  filterAuditRecords: vi.fn((records: unknown[]) => records),
  readAllAuditRecordsAsync: mocks.readAllAuditRecordsAsync,
  readAuditArchivesAsync: mocks.readAuditArchivesAsync,
  verifyAuditLedgerAsync: mocks.verifyAuditLedgerAsync
}));

vi.mock('../security/permissions', () => ({
  canPerformAction: (user: { isAuthenticated: boolean; role: string }, permission: string) =>
    user.isAuthenticated && user.role === 'Super Admin' &&
    (permission === 'storage.rollback' || permission === 'settings.manage')
}));

vi.mock('./StorageMigrationPanel', () => ({
  default: ({ canMigrate }: { canMigrate: boolean }) => (
    <div data-testid="storage-migration-panel">{canMigrate ? 'Migration enabled' : 'Migration view only'}</div>
  )
}));

vi.mock('./StorageMigrationRollbackPanel', () => ({
  default: ({ canRollback }: { canRollback: boolean }) => canRollback
    ? <div data-testid="storage-rollback-panel">Reverse migration enabled</div>
    : null
}));

function user(role: 'Viewer' | 'Admin' | 'Super Admin') {
  return {
    id: 'test-user',
    name: 'Test User',
    email: 'test@example.test',
    role,
    isAuthenticated: true,
    mustChangePassword: false
  } as const;
}

function renderCenter(role: 'Viewer' | 'Admin' | 'Super Admin') {
  return render(
    <SecurityCenter
      language="en"
      currentUser={user(role)}
      onSessionChange={vi.fn()}
      beforeStorageOperation={vi.fn().mockResolvedValue(undefined)}
      onStorageLockChange={vi.fn()}
      onStorageMigrationComplete={vi.fn()}
    />
  );
}

describe('SecurityCenter Storage Management authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listLocalAccountsAsync.mockResolvedValue([]);
    mocks.localAccountRegistryErrorAsync.mockResolvedValue(null);
    mocks.verifyAuditLedgerAsync.mockResolvedValue({
      valid: true,
      activeChecked: 0,
      archivedChecked: 0,
      archiveCount: 0,
      brokenArchiveIndex: null,
      brokenRecordIndex: null
    });
    mocks.readAllAuditRecordsAsync.mockResolvedValue([]);
    mocks.readAuditArchivesAsync.mockResolvedValue([]);
    mocks.appendAuditRecordAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not expose the Security Management tabs to a non-admin role', async () => {
    renderCenter('Viewer');
    await waitFor(() => expect(screen.getByText(/Audit log integrity/i)).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: /Storage Management/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('storage-migration-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('storage-rollback-panel')).not.toBeInTheDocument();
  });

  it('shows Storage Management to Admin as read-only without migration or rollback controls', async () => {
    renderCenter('Admin');
    const tab = await screen.findByRole('tab', { name: /Storage Management/i });
    fireEvent.click(tab);
    expect(screen.getByTestId('storage-migration-panel')).toHaveTextContent(/view only/i);
    expect(screen.queryByTestId('storage-rollback-panel')).not.toBeInTheDocument();
  });

  it('enables migration and reverse migration controls only for Super Admin', async () => {
    renderCenter('Super Admin');
    fireEvent.click(await screen.findByRole('tab', { name: /Storage Management/i }));
    expect(screen.getByTestId('storage-migration-panel')).toHaveTextContent(/Migration enabled/i);
    expect(screen.getByTestId('storage-rollback-panel')).toHaveTextContent(/Reverse migration enabled/i);
  });
});
