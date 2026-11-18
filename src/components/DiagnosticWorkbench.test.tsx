import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import DiagnosticWorkbench from './DiagnosticWorkbench';
import { initialShuttles } from '../data/mockData';

describe('DiagnosticWorkbench', () => {
  it('builds a selectable inspection checklist and tracks completed checks', async () => {
    const user = userEvent.setup();
    render(<DiagnosticWorkbench language="en" shuttles={initialShuttles} canCreateFault={false} onCreateFault={async () => undefined}/>);
    expect(screen.getByText(/RULE-BASED · NOT AI GENERATED/i)).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: /Observed symptom/i }), 'wheel-slip');
    expect(screen.getByRole('heading', { name: /Wheel slip on cold-room floor/i })).toBeInTheDocument();
    const checks = screen.getAllByRole('checkbox');
    expect(checks).toHaveLength(4);
    await user.click(checks[0]);
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
  });

  it('keeps the safety and non-AI limitations visible in Arabic', () => {
    render(<DiagnosticWorkbench language="ar" shuttles={initialShuttles} canCreateFault={false} onCreateFault={async () => undefined}/>);
    expect(screen.getByText(/تنبيه سلامة/)).toBeInTheDocument();
    expect(screen.getByText(/لا يوجد مزود ذكاء اصطناعي متصل/)).toBeInTheDocument();
  });

  it('does not claim to save a diagnosis when clipboard access is unavailable', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    render(<DiagnosticWorkbench language="en" shuttles={initialShuttles} canCreateFault={false} onCreateFault={async () => undefined}/>);
    await user.click(screen.getByRole('button', { name: /Copy inspection report/i }));
    expect(await screen.findByText(/Clipboard is unavailable/i)).toBeInTheDocument();
  });

  it('registers a reviewed diagnostic as a formal fault only after severity selection', async () => {
    const user = userEvent.setup();
    const onCreateFault = vi.fn().mockResolvedValue(undefined);
    render(<DiagnosticWorkbench language="en" shuttles={initialShuttles} canCreateFault={true} onCreateFault={onCreateFault}/>);
    const createButton = screen.getByRole('button', { name: /Create fault report/i });
    expect(createButton).toBeDisabled();
    await user.selectOptions(screen.getByRole('combobox', { name: /Initial report severity/i }), 'Major');
    await user.type(screen.getByRole('textbox', { name: /Field findings and measurements/i }), 'Sensor bracket was loose during inspection.');
    expect(createButton).toBeEnabled();
    await user.click(createButton);
    expect(onCreateFault).toHaveBeenCalledWith(expect.objectContaining({
      shuttleId: initialShuttles[0].id,
      title: 'Wooden pallet not detected',
      severity: 'Major',
      description: expect.stringContaining('Sensor bracket was loose')
    }));
  });
});
