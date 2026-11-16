import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { beforeEach, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';

describe('Shuttle Car Automation V6', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the industrial dashboard', () => {
    render(<App />);
    expect(screen.getByText(/Total shuttle cars/i)).toBeInTheDocument();
    expect(screen.getByText(/Running shuttles/i)).toBeInTheDocument();
    expect(screen.getByText(/System communication status/i)).toBeInTheDocument();
  });

  it('switches to Arabic and updates interface direction', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Arabic/i }));
    expect(screen.getByText(/لوحة القيادة/i)).toBeInTheDocument();
    expect(screen.getByText(/إجمالي عربات النقل/i)).toBeInTheDocument();
  });
  it('clearly identifies the interface as a demo without live equipment access', () => {
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent(/DEMO MODE/i);
    expect(screen.getByRole('status')).toHaveTextContent(/No live equipment connection/i);
  });

  it('persists the selected appearance across a reload', async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);
    await user.click(screen.getByRole('button', { name: /Light mode/i }));
    expect(firstRender.container.querySelector('.app-shell')).toHaveClass('light');
    firstRender.unmount();

    const secondRender = render(<App />);
    expect(secondRender.container.querySelector('.app-shell')).toHaveClass('light');
  });

  it('allows manual battery status updates in the battery workspace', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Battery Management/i }));
    await user.click(screen.getByRole('button', { name: /Set charging/i }));
    expect(screen.getAllByText('Charging').length).toBeGreaterThan(0);
  });

  it('does not allow a fault to be resolved without a corrective action', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Fault & Diagnostics/i }));
    const resolveButtons = screen.getAllByRole('button', { name: /Resolve fault/i });
    expect(resolveButtons.some((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it('requires and records corrective action before resolving a fault', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Fault & Diagnostics/i }));
    const actionFields = screen.getAllByPlaceholderText('Document corrective action');
    await user.type(actionFields[0], 'Replaced damaged sensor and verified detection in a controlled test.');
    const saveButtons = screen.getAllByRole('button', { name: /Save corrective action/i });
    await user.click(saveButtons[0]);
    const resolveButtons = screen.getAllByRole('button', { name: /Resolve fault/i });
    expect((resolveButtons[0] as HTMLButtonElement).disabled).toBe(false);
    await user.click(resolveButtons[0]);
    expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
  });

});
