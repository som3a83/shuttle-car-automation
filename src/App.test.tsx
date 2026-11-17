import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { initialShuttles } from './data/mockData';
import { beforeEach, describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';

describe('Shuttle Car Automation V9', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({ tab: 'dashboard' }, '', '#/dashboard');
  });

  it('renders the industrial dashboard and current application release label', () => {
    render(<App />);
    expect(screen.getByText(/Total shuttle cars/i)).toBeInTheDocument();
    expect(screen.getByText(/Running shuttles/i)).toBeInTheDocument();
    expect(screen.getByText(/System communication status/i)).toBeInTheDocument();
    expect(screen.getByText('SHUTTLE OPS · V10 OPERATIONS PLATFORM')).toBeInTheDocument();
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

  it('shows a traceable manufacturer reference and does not invent the installed cold-room rating', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    expect(screen.getByText(/ISAT pallet shuttle satellite — reference family/i)).toBeInTheDocument();
    expect(screen.getByText(/exact configuration on SC-01 to SC-03 is not verified/i)).toBeInTheDocument();
    expect(screen.getByText(/does not specify a cold-room temperature rating/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Cassioli product reference/i })).toHaveAttribute(
      'href',
      'https://www.cassioli.com/intralogistics-division/automated-warehouses/pallet-shuttle/'
    );
  });

  it('opens the shift workspace and persists completed handover records in local storage', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Shift Operations & Handover/i })[0]);
    expect(window.location.hash).toBe('#/shifts');
    await user.type(screen.getByLabelText(/Shift supervisor/i), 'Operations Supervisor');
    await user.type(screen.getByLabelText(/Operators \/ technicians/i), 'Operator One, Technician Two');
    await user.click(screen.getByRole('button', { name: /Start shift now/i }));
    const openRecords = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shifts') || '[]');
    expect(openRecords).toHaveLength(1);
    expect(openRecords[0]).toMatchObject({ supervisor: 'Operations Supervisor', endedAt: null, openingFleet: expect.arrayContaining([expect.objectContaining({ id: 'SC-01' })]) });
    await user.type(screen.getByLabelText(/Handover notes for the next shift/i), 'Check SC-04 wheel grip and inspect battery status.');
    await user.click(screen.getByRole('button', { name: /Close shift & save handover/i }));
    const closedRecords = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shifts') || '[]');
    expect(closedRecords[0].endedAt).toBeTruthy();
    expect(closedRecords[0].handoverNotes).toContain('SC-04 wheel grip');
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

  it('persists notification records across an application remount', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.click(screen.getByRole('button', { name: /Set available/i }));
    first.unmount();

    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Notifications/i })[0]);
    expect(screen.getByText('Battery status changed')).toBeInTheDocument();
    expect(screen.getByText(/BAT-ACME-01: Fault → Available/)).toBeInTheDocument();
  });

  it('clears the complete local notification list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.click(screen.getByRole('button', { name: /Set available/i }));
    await user.click(screen.getAllByRole('button', { name: /Notifications/i })[0]);
    await user.click(screen.getByRole('button', { name: /Clear all notifications/i }));
    expect(screen.getByText(/No new local notifications/i)).toBeInTheDocument();
  });

  it('creates and advances a maintenance work order with matching local event records', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Maintenance Management/i })[0]);
    await user.type(screen.getByLabelText(/Work order title/i), 'Monthly rail inspection');
    await user.type(screen.getByLabelText(/Scheduled date/i), '2026-11-20');
    await user.click(screen.getByRole('button', { name: /Save work order/i }));
    expect(screen.getByText('Monthly rail inspection')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Start job/i }));
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Complete job/i }));
    expect(screen.getByText('Completed')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Notifications/i })[0]);
    expect(screen.getByText('Maintenance work order created')).toBeInTheDocument();
    expect(screen.getAllByText('Maintenance work order updated')).toHaveLength(2);
  });

  it('registers a new fleet unit without fabricating manufacturer identity data', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    await user.selectOptions(screen.getByLabelText(/^Manufacturer$/i), 'Craftsman');
    await user.type(screen.getByLabelText(/Operating zone/i), 'Cold room test zone');
    await user.click(screen.getByRole('button', { name: /Save new device/i }));
    expect(screen.getAllByText('SC-06').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Craftsman').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
  });

  it('migrates legacy placeholder zero counters without changing verified zero readings', () => {
    const legacyShuttles = [
      ...initialShuttles.map((shuttle) => ({ ...shuttle, operatingHours: 0, operatingCycles: 0 })),
      {
        ...initialShuttles[0],
        id: 'SC-VERIFIED',
        model: 'Verified model',
        serialNumber: 'Verified serial',
        connectivity: 'REAL' as const,
        status: 'Ready' as const,
        operatingHours: 0,
        operatingCycles: 0
      }
    ];
    window.localStorage.setItem(
      'shuttle-car-automation-v7:shuttles',
      JSON.stringify(legacyShuttles)
    );

    render(<App />);

    const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shuttles') || '[]') as Array<{
      id: string;
      operatingHours: number | null;
      operatingCycles: number | null;
    }>;
    expect(saved.slice(0, 5).every((shuttle) => shuttle.operatingHours === null && shuttle.operatingCycles === null)).toBe(true);
    expect(saved[5]).toMatchObject({ id: 'SC-VERIFIED', operatingHours: 0, operatingCycles: 0 });
  });

  it('keeps all thirteen named application destinations reachable from the main navigation', async () => {
    const user = userEvent.setup();
    render(<App />);
    const destinations = [
      ['Dashboard', 'Dashboard'],
      ['Fleet Control Center', 'Fleet Control Center'],
      ['Shift Operations & Handover', 'Shift Operations & Handover'],
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

  it('edits a shuttle identity record and persists the updated model details', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    await user.click(screen.getByRole('button', { name: /Edit equipment/i }));
    await user.clear(screen.getAllByLabelText(/^Model$/i)[0]);
    await user.type(screen.getAllByLabelText(/^Model$/i)[0], 'Verified test model');
    await user.clear(screen.getAllByLabelText(/Manufacturer serial/i)[0]);
    await user.type(screen.getAllByLabelText(/Manufacturer serial/i)[0], 'SERIAL-TEST-001');
    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    expect(screen.getByText('Verified test model')).toBeInTheDocument();
    expect(screen.getByText('SERIAL-TEST-001')).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shuttles') || '[]') as Array<{id:string;model:string}>;
    expect(saved.find(item => item.id === 'SC-01')?.model).toBe('Verified test model');
  });

  it('archives a shuttle without deleting its history and supports restoring it', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    await user.click(screen.getByRole('button', { name: /Archive device/i }));
    await user.click(screen.getByRole('button', { name: /Confirm archive/i }));
    expect(screen.queryByRole('button', { name: /SC-01 Cassioli/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show archived devices/i }));
    const archive = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shuttles') || '[]') as Array<{id:string;archivedAt?:string|null}>;
    expect(archive.find(item => item.id === 'SC-01')?.archivedAt).toBeTruthy();
    await user.click(screen.getAllByRole('button', { name: /Restore/i })[0]);
    expect(window.localStorage.getItem('shuttle-car-automation-v7:shuttles')).toContain('"archivedAt":null');
  });

  it('registers and assigns a new battery to an active shuttle', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.type(screen.getByLabelText(/^Manufacturer$/i), 'ACME');
    await user.type(screen.getByLabelText(/^Model$/i), 'Pack test A');
    await user.selectOptions(screen.getByLabelText(/^Assign to shuttle$/i), 'SC-01');
    await user.click(screen.getByRole('button', { name: /Save battery$/i }));
    expect(screen.getAllByText('BAT-001').length).toBeGreaterThan(0);
    expect(screen.getByText('ACME · SC-01')).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:batteries') || '[]') as Array<{id:string;assignment:string;status:string}>;
    expect(saved.find(item => item.id === 'BAT-001')).toMatchObject({assignment:'SC-01',status:'Installed'});
  });

  it('saves manually entered battery readings without marking them as live telemetry', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.click(screen.getByRole('button', { name: /Edit battery details/i }));
    await user.clear(screen.getByLabelText(/SOC %/i));
    await user.type(screen.getByLabelText(/SOC %/i), '12.5');
    await user.click(screen.getByRole('button', { name: /Save battery data/i }));
    expect(screen.getByText('12.5% (manual / reported)')).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:batteries') || '[]') as Array<{id:string;soc:number|null;connectionMode:string}>;
    expect(saved.find(item => item.id === 'BAT-ACME-01')).toMatchObject({soc:12.5,connectionMode:'UNKNOWN'});
  });

  it('generates and retains a daily equipment status snapshot', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Reports Center/i })[0]);
    await user.click(screen.getByRole('button', { name: /Generate today.s report/i }));
    expect(screen.getByText(/LATEST SAVED DAILY REPORT/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download daily report CSV/i })).toBeInTheDocument();
    first.unmount();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Reports Center/i })[0]);
    expect(screen.getByText(/Daily report history/i)).toBeInTheDocument();
    const reports = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:dailyReports') || '[]') as Array<{shuttleCount:number;verifiedTelemetryCount:number}>;
    expect(reports[0]).toMatchObject({shuttleCount:5,verifiedTelemetryCount:0});
  });

  it('provides working in-app back and home navigation controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    await user.click(screen.getByRole('button', { name: /Go back/i }));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Fleet Control Center');
    await user.click(screen.getByRole('button', { name: /Home/i }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard');
  });

  it('opens system settings directly from the fixed workspace controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /^Settings$/i }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('System Settings');
    expect(screen.getByText(/Backup and restore/i)).toBeInTheDocument();
  });

});
