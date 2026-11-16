import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { beforeEach, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';

describe('Shuttle Car Automation V6', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({ tab: 'dashboard' }, '', '#/dashboard');
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
    expect(screen.getAllByText(/لوحة القيادة/i).length).toBeGreaterThan(0);
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
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
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


  it('navigates into the engineering workspace and changes drawing views', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    expect(screen.getByText(/ISOMETRIC ASSEMBLY/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Top$/i }));
    expect(screen.getByText(/TOP PLAN/i)).toBeInTheDocument();
    expect(screen.getByText(/ASSEMBLY BREAKDOWN/i)).toBeInTheDocument();
  });

  it('switches between fleet, battery, fault and maintenance workspaces', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    expect(screen.getByText(/Register new equipment/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    expect(screen.getByText(/Battery assets/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Fault & Diagnostics/i }));
    expect(screen.getByText(/Multiple operating anomalies reported/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Maintenance Management/i }));
    expect(screen.getByText(/Create work order/i)).toBeInTheDocument();
  });

  it('uses address-based navigation so modules can be opened, refreshed and revisited', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    expect(window.location.hash).toBe('#/fleet');
    expect(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    expect(window.location.hash).toBe('#/engineering');
    expect(screen.getByText(/ISOMETRIC ASSEMBLY/i)).toBeInTheDocument();
  });

  it('provides direct mobile destinations for the main operating workspaces', () => {
    render(<App />);
    expect(screen.getByRole('navigation', { name: /Quick navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /More/i })).toBeInTheDocument();
  });

  it('allows the operator to inspect individual engineering assemblies', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    await user.click(screen.getByRole('button', { name: /Traction wheels/i }));
    expect(screen.getByText(/SELECTED COMPONENT INSPECTOR/i)).toBeInTheDocument();
    expect(screen.getByText(/Check tread wear/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Drawing zoom/i)).toBeInTheDocument();
  });

  it('opens a module directly from its URL hash', () => {
    window.history.replaceState({ tab: 'batteries' }, '', '#/batteries');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Battery Management');
    expect(window.location.hash).toBe('#/batteries');
  });

  it('synchronizes the displayed module when browser history changes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    act(() => {
      window.history.replaceState({ tab: 'fleet' }, '', '#/fleet');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Fleet Control Center');
  });

  it('opens remaining modules from the mobile More drawer and closes it after navigation', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('button', { name: /More/i }));
    expect(container.querySelector('.sidebar')).toHaveClass('mobile-open');
    await user.click(screen.getByRole('button', { name: /AI Technical Assistant/i }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AI Technical Assistant');
    expect(container.querySelector('.sidebar')).not.toHaveClass('mobile-open');
    expect(window.location.hash).toBe('#/ai');
  });

  it('creates a local notification when a fault report is submitted', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Fault & Diagnostics/i })[0]);
    await user.type(screen.getByLabelText(/Fault title/i), 'Photoelectric sensor interruption');
    await user.type(screen.getByLabelText(/Observed symptom/i), 'Sensor signal was interrupted during inspection.');
    await user.click(screen.getByRole('button', { name: /Register fault/i }));
    await user.click(screen.getAllByRole('button', { name: /Notifications/i })[0]);
    expect(screen.getByText('New fault report recorded')).toBeInTheDocument();
    expect(screen.getByText(/Photoelectric sensor interruption/)).toBeInTheDocument();
  });

  it('allows a local notification to be dismissed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.click(screen.getByRole('button', { name: /Set available/i }));
    await user.click(screen.getAllByRole('button', { name: /Notifications/i })[0]);
    expect(screen.getByText('Battery status changed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Dismiss notification/i }));
    expect(screen.getByText(/No new local notifications/i)).toBeInTheDocument();
  });

  it('respects the master notification preference', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /System Settings/i })[0]);
    await user.click(screen.getByRole('checkbox', { name: /Enable local notifications/i }));
    await user.click(screen.getAllByRole('button', { name: /Fault & Diagnostics/i })[0]);
    await user.type(screen.getByLabelText(/Fault title/i), 'Notification preference check');
    await user.type(screen.getByLabelText(/Observed symptom/i), 'Local notification generation is disabled.');
    await user.click(screen.getByRole('button', { name: /Register fault/i }));
    await user.click(screen.getAllByRole('button', { name: /Notifications/i })[0]);
    expect(screen.getByText(/No new local notifications/i)).toBeInTheDocument();
  });

  it('keeps all twelve named application destinations reachable from the main navigation', async () => {
    const user = userEvent.setup();
    render(<App />);
    const destinations = [
      ['Dashboard', 'Dashboard'],
      ['Fleet Control Center', 'Fleet Control Center'],
      ['Engineering Visualization', 'Engineering Visualization'],
      ['Battery Management', 'Battery Management'],
      ['Fault & Diagnostics', 'Fault & Diagnostics'],
      ['Maintenance Management', 'Maintenance Management'],
      ['Device Connections', 'Device Connections'],
      ['AI Technical Assistant', 'AI Technical Assistant'],
      ['Reports Center', 'Reports Center'],
      ['Notifications', 'Notifications'],
      ['Users & Security', 'Users & Security'],
      ['System Settings', 'System Settings']
    ];
    for (const [label, heading] of destinations) {
      await user.click(screen.getAllByRole('button', { name: new RegExp(label, 'i') })[0]);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
    }
  });
});
