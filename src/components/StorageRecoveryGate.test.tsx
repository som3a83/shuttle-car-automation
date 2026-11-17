import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StorageRecoveryGate from './StorageRecoveryGate';
import type { OperationalBootstrapResult } from '../security/operationalStorage';

afterEach(() => { cleanup(); localStorage.clear(); });

const recoveryState: Extract<OperationalBootstrapResult, { status: 'recovery-required' }> = {
  status: 'recovery-required',
  issues: ['Conflicting verified and legacy shuttle data.'],
  items: [{
    collection: 'shuttles',
    reason: 'A verified primary snapshot and a different valid legacy copy both exist.',
    primary: { status: 'valid', revision: 4, schemaVersion: 1 },
    previous: { status: 'valid', revision: 3, schemaVersion: 1 },
    legacy: { status: 'valid' },
    primaryData: [{ id: 'SC-PRIMARY', status: 'Running' }],
    previousData: [{ id: 'SC-PREVIOUS', status: 'Idle' }],
    legacyData: [{ id: 'SC-LEGACY', status: 'Maintenance' }],
    canUseEmpty: true
  }]
};

describe('operational data recovery gate', () => {
  it('requires an exact candidate preview before a restore or migration can be applied', () => {
    render(<StorageRecoveryGate initial={recoveryState} onRecovered={() => undefined} />);

    const primary = screen.getByRole('button', { name: /Use verified primary/i });
    const previous = screen.getByRole('button', { name: /Restore this snapshot/i });
    const legacy = screen.getByRole('button', { name: /Migrate this copy/i });
    const previews = screen.getAllByRole('button', { name: /^Preview$/i });

    expect(primary).toBeDisabled();
    expect(previous).toBeDisabled();
    expect(legacy).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Preview and use/i }));
    expect(primary).toBeEnabled();
    expect(previous).toBeDisabled();
    expect(legacy).toBeDisabled();

    fireEvent.click(previews[0]);
    expect(primary).toBeDisabled();
    expect(previous).toBeEnabled();
    expect(legacy).toBeDisabled();

    fireEvent.click(previews[1]);
    expect(primary).toBeDisabled();
    expect(previous).toBeDisabled();
    expect(legacy).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /Close preview/i }));
    expect(legacy).toBeDisabled();
  });
});
