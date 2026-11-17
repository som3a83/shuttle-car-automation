import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import ShiftOperations from './ShiftOperations';
import { initialShuttles, initialFaults, initialMaintenance } from '../data/mockData';
import type { ShiftRecord } from '../types';

function Harness() {
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  return <ShiftOperations language="en" shifts={shifts} onChange={setShifts}
    shuttles={initialShuttles} faults={initialFaults} jobs={initialMaintenance}/>;
}

describe('Shift operations and handover', () => {
  beforeEach(() => window.localStorage.clear());

  it('requires a supervisor and operators before starting a shift', async () => {
    const user = userEvent.setup();
    render(<Harness/>);
    expect(screen.getByRole('button', { name: /Start shift now/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/Shift supervisor/i), 'Shift Lead');
    expect(screen.getByRole('button', { name: /Start shift now/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/Operators \/ technicians/i), 'Operator A, Technician B');
    expect(screen.getByRole('button', { name: /Start shift now/i })).toBeEnabled();
  });

  it('starts one shift with a snapshot of the fleet and open work', async () => {
    const user = userEvent.setup();
    render(<Harness/>);
    await user.type(screen.getByLabelText(/Shift supervisor/i), 'Shift Lead');
    await user.type(screen.getByLabelText(/Operators \/ technicians/i), 'Operator A');
    await user.click(screen.getByRole('button', { name: /Start shift now/i }));
    expect(screen.getByText(/CURRENT SHIFT/i)).toBeInTheDocument();
    expect(screen.getByText(/SC-01/)).toBeInTheDocument();
    expect(screen.getAllByText(/Opening fleet snapshot/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Close shift & save handover/i })).toBeDisabled();
  });

  it('requires handover notes to close a shift and keeps the completed record', async () => {
    const user = userEvent.setup();
    render(<Harness/>);
    await user.type(screen.getByLabelText(/Shift supervisor/i), 'Shift Lead');
    await user.type(screen.getByLabelText(/Operators \/ technicians/i), 'Operator A');
    await user.click(screen.getByRole('button', { name: /Start shift now/i }));
    const notes = screen.getByLabelText(/Handover notes for the next shift/i);
    await user.type(notes, 'SC-04 requires inspection of wheel grip and sensor events.');
    await user.click(screen.getByRole('button', { name: /Close shift & save handover/i }));
    expect(screen.getByText(/NO OPEN SHIFT/i)).toBeInTheDocument();
    expect(screen.getByText(/SC-04 requires inspection of wheel grip and sensor events./i)).toBeInTheDocument();
    expect(screen.getByText(/CLOSED/i)).toBeInTheDocument();
    expect(screen.getByText(/Previous shifts & handover records/i)).toBeInTheDocument();
  });
});
