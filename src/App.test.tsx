import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { type AppInitialData } from './App';
import { defaultSettings, initialBatteries, initialConnections, initialFaults, initialMaintenance, initialNotifications, initialShuttles } from './data/mockData';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_CUSTOMIZATION, loadCustomization } from './data/applicationCustomization';
import { webcrypto } from 'node:crypto';
import { authenticateLocalAccount, createLocalAccount, listLocalAccounts, readLocalSession } from './security/localAuth';
import { readOperationalStorageIssues } from './security/operationalStorage';

const testCrypto = webcrypto as unknown as Crypto;

function readTestValue<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`shuttle-car-automation-v7:${key}`);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (key === 'shuttles' && Array.isArray(parsed)) {
      return parsed.map((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
        const shuttle = value as { model?: string; serialNumber?: string; connectivity?: string; status?: string; operatingHours?: number | null; operatingCycles?: number | null };
        const placeholder = shuttle.model === 'Not recorded' && shuttle.serialNumber === 'Not recorded' &&
          shuttle.connectivity === 'UNKNOWN' && shuttle.status === 'Unknown';
        return placeholder ? {
          ...shuttle,
          operatingHours: shuttle.operatingHours === 0 ? null : shuttle.operatingHours,
          operatingCycles: shuttle.operatingCycles === 0 ? null : shuttle.operatingCycles
        } : shuttle;
      }) as T;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function getTestInitialData(): AppInitialData {
  const session = readLocalSession(window.sessionStorage, window.localStorage);
  listLocalAccounts(window.localStorage);
  return {
    language: readTestValue('language', 'en'),
    theme: readTestValue('theme', 'dark'),
    customization: loadCustomization(window.localStorage),
    currentUser: session
      ? { id: session.accountId, name: session.name, role: session.role, email: session.email, isAuthenticated: true, mustChangePassword: session.mustChangePassword }
      : { id: 'local-guest', name: 'Local guest', role: 'Viewer', email: '', isAuthenticated: false },
    shuttles: readTestValue('shuttles', initialShuttles),
    batteries: readTestValue('batteries', initialBatteries),
    faults: readTestValue('faults', initialFaults),
    jobs: readTestValue('maintenance', initialMaintenance),
    connections: readTestValue('connections', initialConnections),
    notifications: readTestValue('notifications', initialNotifications),
    settings: readTestValue('settings', defaultSettings),
    sidebarCollapsed: readTestValue('sidebarCollapsed', false),
    storageIssues: readOperationalStorageIssues(window.localStorage),
    dailyReports: readTestValue('dailyReports', []),
    shifts: readTestValue('shifts', [])
  };
}

function renderApp() {
  return render(<App initialData={getTestInitialData()} />);
}

describe('Shuttle Car Automation V10', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubGlobal('crypto', webcrypto);
    const credentials = {
      name: 'Automation Test Administrator',
      email: 'automation-admin@example.test',
      username: 'automation-admin',
      role: 'Super Admin' as const,
      password: 'Automation-Test-Admin-2026!'
    };
    await createLocalAccount(credentials, window.localStorage, testCrypto);
    const signIn = await authenticateLocalAccount(
      credentials.username, credentials.password, window.localStorage, window.sessionStorage, testCrypto
    );
    if (!signIn.ok) throw new Error(`Test administrator sign-in failed: ${signIn.reason}`);
    window.history.replaceState({ tab: 'dashboard' }, '', '#/dashboard');
  });

  it('renders the industrial dashboard and current application release label', () => {
    renderApp();
    expect(screen.getByText(/Total shuttle cars/i)).toBeInTheDocument();
    expect(screen.getByText(/Running shuttles/i)).toBeInTheDocument();
    expect(screen.getByText(/System communication status/i)).toBeInTheDocument();
    expect(screen.getByText('SHUTTLE CAR AUTOMATION · V1.0.0')).toBeInTheDocument();
  });

  it('keeps protected destinations unavailable when the local session is missing', () => {
    window.sessionStorage.clear();
    renderApp();
    expect(screen.queryByRole('button', { name: /Battery Management/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Maintenance Management/i })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/DEMO MODE/i);
  });

  it('switches to Arabic and updates interface direction', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /Arabic/i }));
    expect(screen.getAllByText(/لوحة القيادة/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/إجمالي عربات النقل/i)).toBeInTheDocument();
  });
  it('clearly identifies the interface as a demo without live equipment access', () => {
    renderApp();
    expect(screen.getByRole('status')).toHaveTextContent(/DEMO MODE/i);
    expect(screen.getByRole('status')).toHaveTextContent(/No live equipment connection/i);
  });

  it('persists the selected appearance across a reload', async () => {
    const user = userEvent.setup();
    const firstRender = renderApp();
    await user.click(screen.getByRole('button', { name: /Light mode/i }));
    expect(firstRender.container.querySelector('.app-shell')).toHaveClass('light');
    firstRender.unmount();

    const secondRender = renderApp();
    expect(secondRender.container.querySelector('.app-shell')).toHaveClass('light');
  });

  it('allows manual battery status updates in the battery workspace', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.click(screen.getByRole('button', { name: /Set charging/i }));
    await waitFor(() => expect(screen.getAllByText('Charging').length).toBeGreaterThan(0));
  });

  it('does not allow a fault to be resolved without a corrective action', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /Fault & Diagnostics/i }));
    const resolveButtons = screen.getAllByRole('button', { name: /Resolve fault/i });
    expect(resolveButtons.some((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it('requires and records corrective action before resolving a fault', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /Fault & Diagnostics/i }));
    const actionFields = screen.getAllByPlaceholderText('Document corrective action');
    await user.type(actionFields[0], 'Replaced damaged sensor and verified detection in a controlled test.');
    const saveButtons = screen.getAllByRole('button', { name: /Save corrective action/i });
    await user.click(saveButtons[0]);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Resolve fault/i })[0]).toBeEnabled();
    });
    expect(screen.getByText('Replaced damaged sensor and verified detection in a controlled test.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Resolve fault/i })[0]);
    await waitFor(() => expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0));
  });


  it('navigates into the engineering workspace and changes drawing views', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    expect(await screen.findByText(/ISOMETRIC ASSEMBLY/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Top$/i }));
    expect(await screen.findByText(/TOP PLAN/i)).toBeInTheDocument();
    expect(await screen.findByText(/ASSEMBLY BREAKDOWN/i)).toBeInTheDocument();
  });

  it('provides direct access to editable parametric CAD source files', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    const sourceLink = await screen.findByRole('link', { name: /Open editable parametric CAD source/i });
    expect(sourceLink).toHaveAttribute('href', 'https://github.com/som3a83/shuttle-car-automation/tree/main/cad');
    expect(sourceLink).toHaveAttribute('target', '_blank');
  });

  it('switches between fleet, battery, fault and maintenance workspaces', async () => {
    const user = userEvent.setup();
    renderApp();
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
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    expect(window.location.hash).toBe('#/fleet');
    expect(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    expect(window.location.hash).toBe('#/engineering');
    expect(screen.getByText(/ISOMETRIC ASSEMBLY/i)).toBeInTheDocument();
  });

  it('provides direct mobile destinations for the main operating workspaces', () => {
    renderApp();
    expect(screen.getByRole('navigation', { name: /Quick navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /More/i })).toBeInTheDocument();
  });

  it('allows the operator to inspect individual engineering assemblies', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    await user.click(screen.getByRole('button', { name: /Traction wheels/i }));
    expect(screen.getByText(/SELECTED COMPONENT INSPECTOR/i)).toBeInTheDocument();
    expect(screen.getByText(/Check tread wear/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Orthographic zoom/i)).toBeInTheDocument();
  });

  it('shows a traceable manufacturer reference and does not invent the installed cold-room rating', async () => {
    const user = userEvent.setup();
    renderApp();
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
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Shift Operations & Handover/i })[0]);
    expect(window.location.hash).toBe('#/shifts');
    await user.type(screen.getByLabelText(/Shift supervisor/i), 'Operations Supervisor');
    await user.type(screen.getByLabelText(/Operators \/ technicians/i), 'Operator One, Technician Two');
    await user.click(screen.getByRole('button', { name: /Start shift now/i }));
    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shifts') || '[]')).toHaveLength(1);
    });
    const openRecords = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shifts') || '[]');
    expect(openRecords[0]).toMatchObject({ supervisor: 'Operations Supervisor', endedAt: null, openingFleet: expect.arrayContaining([expect.objectContaining({ id: 'SC-01' })]) });
    await user.type(screen.getByLabelText(/Handover notes for the next shift/i), 'Check SC-04 wheel grip and inspect battery status.');
    await user.click(screen.getByRole('button', { name: /Close shift & save handover/i }));
    await waitFor(() => {
      const closedRecords = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shifts') || '[]');
      expect(closedRecords[0]?.endedAt).toBeTruthy();
      expect(closedRecords[0]?.handoverNotes).toContain('SC-04 wheel grip');
    });
  });

  it('opens a module directly from its URL hash', () => {
    window.history.replaceState({ tab: 'batteries' }, '', '#/batteries');
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Battery Management');
    expect(window.location.hash).toBe('#/batteries');
  });

  it('synchronizes the displayed module when browser history changes', async () => {
    const user = userEvent.setup();
    renderApp();
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
    const { container } = renderApp();
    await user.click(screen.getByRole('button', { name: /More/i }));
    expect(container.querySelector('.sidebar')).toHaveClass('mobile-open');
    await user.click(screen.getByRole('button', { name: /AI Technical Assistant/i }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AI Technical Assistant');
    expect(container.querySelector('.sidebar')).not.toHaveClass('mobile-open');
    expect(window.location.hash).toBe('#/ai');
  });

  it('creates a local notification when a fault report is submitted', async () => {
    const user = userEvent.setup();
    renderApp();
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
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.click(screen.getByRole('button', { name: /Set available/i }));
    await user.click(screen.getAllByRole('button', { name: /Notifications/i })[0]);
    expect(screen.getByText('Battery status changed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Dismiss notification/i }));
    expect(screen.getByText(/No new local notifications/i)).toBeInTheDocument();
  });

  it('respects the master notification preference', async () => {
    const user = userEvent.setup();
    renderApp();
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
    const first = renderApp();
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.click(screen.getByRole('button', { name: /Set available/i }));
    first.unmount();

    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Notifications/i })[0]);
    expect(screen.getByText('Battery status changed')).toBeInTheDocument();
    expect(screen.getByText(/BAT-ACME-01: Fault → Available/)).toBeInTheDocument();
  });

  it('clears the complete local notification list', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.click(screen.getByRole('button', { name: /Set available/i }));
    await user.click(screen.getAllByRole('button', { name: /Notifications/i })[0]);
    await user.click(screen.getByRole('button', { name: /Clear all notifications/i }));
    expect(await screen.findByText(/No new local notifications/i)).toBeInTheDocument();
  });

  it('creates and advances a maintenance work order with matching local event records', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Maintenance Management/i })[0]);
    await user.type(screen.getByLabelText(/Work order title/i), 'Monthly rail inspection');
    await user.type(screen.getByLabelText(/Scheduled date/i), '2026-11-20');
    await user.click(screen.getByRole('button', { name: /Save work order/i }));
    await waitFor(() => expect(screen.getByText('Monthly rail inspection')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Start job/i }));
    await waitFor(() => expect(screen.getByText('In Progress')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Complete job/i }));
    await user.type(screen.getByLabelText(/Completion result \/ work performed/i), 'Inspected rails and documented clearance verification.');
    await user.click(screen.getByRole('button', { name: /Save result & complete/i }));
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText(/Completion result: Inspected rails and documented clearance verification/i)).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('button', { name: /Notifications/i })[0]);
    await waitFor(() => {
      expect(screen.getByText('Maintenance work order created')).toBeInTheDocument();
      expect(screen.getByText('Maintenance work order updated')).toBeInTheDocument();
      expect(screen.getByText('Work order completed with recorded result')).toBeInTheDocument();
    });
  });

  it('registers a new fleet unit without fabricating manufacturer identity data', async () => {
    const user = userEvent.setup();
    renderApp();
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

    renderApp();

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
    renderApp();
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
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    await user.click(screen.getByRole('button', { name: /Edit equipment/i }));
    await user.clear(screen.getAllByLabelText(/^Model$/i)[0]);
    await user.type(screen.getAllByLabelText(/^Model$/i)[0], 'Verified test model');
    await user.clear(screen.getAllByLabelText(/Manufacturer serial/i)[0]);
    await user.type(screen.getAllByLabelText(/Manufacturer serial/i)[0], 'SERIAL-TEST-001');
    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    await waitFor(() => {
      expect(screen.getByText('Verified test model')).toBeInTheDocument();
      expect(screen.getByText('SERIAL-TEST-001')).toBeInTheDocument();
      const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shuttles') || '[]') as Array<{id:string;model:string}>;
      expect(saved.find(item => item.id === 'SC-01')?.model).toBe('Verified test model');
    });
  });

  it('archives a shuttle without deleting its history and supports restoring it', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    await user.click(screen.getByRole('button', { name: /Archive device/i }));
    await user.click(screen.getByRole('button', { name: /Confirm archive/i }));
    expect(screen.queryByRole('button', { name: /SC-01 Cassioli/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Show archived devices/i }));
    await waitFor(() => {
      const archive = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shuttles') || '[]') as Array<{id:string;archivedAt?:string|null}>;
      expect(archive.find(item => item.id === 'SC-01')?.archivedAt).toBeTruthy();
    });
    await user.click(screen.getAllByRole('button', { name: /Restore/i })[0]);
    await waitFor(() => expect(window.localStorage.getItem('shuttle-car-automation-v7:shuttles')).toContain('"archivedAt":null'));
  });

  it('blocks shuttle archiving while a linked fault is unresolved', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    await user.click(screen.getByRole('button', { name: /SC-04 Craftsman/i }));
    await user.click(screen.getByRole('button', { name: /Archive device/i }));
    await user.click(screen.getByRole('button', { name: /Confirm archive/i }));
    expect(screen.getByText(/Resolve open fault reports and complete active work orders/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SC-04 Craftsman/i })).toBeInTheDocument();
  });

  it('does not restore a shuttle when its manufacturer serial is already used by an active unit', async () => {
    const shuttles = initialShuttles.map(item => item.id === 'SC-01'
      ? { ...item, serialNumber: 'SERIAL-DUPLICATE', archivedAt: '2026-11-17T00:00:00.000Z' }
      : item.id === 'SC-02'
        ? { ...item, serialNumber: 'SERIAL-DUPLICATE' }
        : item);
    window.localStorage.setItem('shuttle-car-automation-v7:shuttles', JSON.stringify(shuttles));
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    await user.click(screen.getByRole('button', { name: /Show archived devices/i }));
    await user.click(screen.getAllByRole('button', { name: /Restore/i })[0]);
    expect(screen.getByText(/Cannot restore: this manufacturer serial number belongs to another active shuttle/i)).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shuttles') || '[]') as Array<{id:string;archivedAt?:string|null}>;
    expect(saved.find(item => item.id === 'SC-01')?.archivedAt).toBeTruthy();
  });

  it('registers and assigns a new battery to an active shuttle', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.type(screen.getByLabelText(/^Manufacturer$/i), 'ACME');
    await user.type(screen.getByLabelText(/^Model$/i), 'Pack test A');
    await user.selectOptions(screen.getByLabelText(/^Assign to shuttle$/i), 'SC-01');
    await user.click(screen.getByRole('button', { name: /Save battery$/i }));
    await waitFor(() => {
      expect(screen.getAllByText('BAT-001').length).toBeGreaterThan(0);
      expect(screen.getByText('ACME · SC-01')).toBeInTheDocument();
    });
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:batteries') || '[]') as Array<{id:string;assignment:string;status:string;movementHistory?:Array<{action:string;toShuttleId:string}>}>;
      expect(saved.find(item => item.id === 'BAT-001')).toMatchObject({
        assignment:'SC-01', status:'Installed',
        movementHistory: expect.arrayContaining([expect.objectContaining({action:'Assigned',toShuttleId:'SC-01'})])
      });
      const savedShuttles = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:shuttles') || '[]') as Array<{id:string;installedBattery:string}>;
      expect(savedShuttles.find(item => item.id === 'SC-01')?.installedBattery).toBe('BAT-001');
    });
  });

  it('saves manually entered battery readings without marking them as live telemetry', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Battery Management/i })[0]);
    await user.click(screen.getByRole('button', { name: /Edit battery details/i }));
    await user.clear(screen.getByLabelText(/SOC %/i));
    await user.type(screen.getByLabelText(/SOC %/i), '12.5');
    await user.click(screen.getByRole('button', { name: /Save battery data/i }));
    await waitFor(() => expect(screen.getByText('12.5% (manual / reported)')).toBeInTheDocument());
    const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:batteries') || '[]') as Array<{id:string;soc:number|null;connectionMode:string}>;
    expect(saved.find(item => item.id === 'BAT-ACME-01')).toMatchObject({soc:12.5,connectionMode:'UNKNOWN'});
  });

  it('generates and retains a daily equipment status snapshot', async () => {
    const user = userEvent.setup();
    const first = renderApp();
    await user.click(screen.getAllByRole('button', { name: /Reports Center/i })[0]);
    await user.click(screen.getByRole('button', { name: /Generate today.s report/i }));
    await waitFor(() => expect(screen.getByText(/LATEST SAVED DAILY REPORT/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Download daily report CSV/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download daily report Excel/i })).toBeInTheDocument();
    first.unmount();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Reports Center/i })[0]);
    expect(screen.getByText(/Daily report history/i)).toBeInTheDocument();
    const reports = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:dailyReports') || '[]') as Array<{shuttleCount:number;verifiedTelemetryCount:number}>;
    expect(reports[0]).toMatchObject({shuttleCount:5,verifiedTelemetryCount:0});
  });

  it('deletes only the selected daily report snapshot after confirmation', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Reports Center/i })[0]);
    await user.click(screen.getByRole('button', { name: /Generate today.s report/i }));
    await waitFor(() => expect(screen.getByText(/LATEST SAVED DAILY REPORT/i)).toBeInTheDocument());

    const cancelSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));
    cancelSpy.mockRestore();
    let saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:dailyReports') || '[]') as Array<{id:string}>;
    expect(saved).toHaveLength(1);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));
    confirmSpy.mockRestore();
    saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:dailyReports') || '[]') as Array<{id:string}>;
    expect(saved).toHaveLength(0);
    await waitFor(() => expect(screen.queryByText(/LATEST SAVED DAILY REPORT/i)).not.toBeInTheDocument());
  });

  it('provides working in-app back and home navigation controls', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Fleet Control Center/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /Engineering Visualization/i })[0]);
    await user.click(screen.getByRole('button', { name: /Go back/i }));
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Fleet Control Center');
    await user.click(screen.getByRole('button', { name: /Home/i }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard');
  });

  it('collapses and expands the desktop engineering sidebar and remembers the choice locally', async () => {
    const user = userEvent.setup();
    const { container } = renderApp();
    const shell = container.querySelector('.app-shell');
    expect(shell).not.toHaveClass('sidebar-collapsed');

    await user.click(screen.getByRole('button', { name: /Collapse sidebar/i }));
    expect(shell).toHaveClass('sidebar-collapsed');
    expect(screen.getByRole('button', { name: /Expand sidebar/i })).toBeInTheDocument();
    expect(window.localStorage.getItem('shuttle-car-automation-v7:sidebarCollapsed')).toBe('true');

    await user.click(screen.getByRole('button', { name: /Expand sidebar/i }));
    expect(shell).not.toHaveClass('sidebar-collapsed');
    expect(window.localStorage.getItem('shuttle-car-automation-v7:sidebarCollapsed')).toBe('false');
  });

  it('opens system settings directly from the fixed workspace controls', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole('button', { name: /^Settings$/i }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('System Settings');
    expect(screen.getByText(/Backup and restore/i)).toBeInTheDocument();
    expect(screen.getByText(/Privacy & data handling/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Read the full privacy policy/i })).toHaveAttribute(
      'href',
      'https://github.com/som3a83/shuttle-car-automation/blob/main/PRIVACY_POLICY.md'
    );
  });


  it('applies saved navigation labels and dashboard widget visibility to the live application', async () => {
    const user = userEvent.setup();
    renderApp();
    const customization = JSON.parse(JSON.stringify(DEFAULT_CUSTOMIZATION)) as typeof DEFAULT_CUSTOMIZATION;
    const reportsEntry = customization.navigation.find((item) => item.id === 'reports');
    const batteryWidget = customization.dashboard.find((item) => item.id === 'battery-status');
    if (!reportsEntry || !batteryWidget) throw new Error('Expected default customization entries are missing.');
    reportsEntry.label = 'Service reports';
    reportsEntry.labelAr = 'تقارير الخدمات';
    reportsEntry.group = 'CUSTOM OPERATIONS';
    batteryWidget.visible = false;

    act(() => {
      window.dispatchEvent(new CustomEvent('shuttle-customization-change', { detail: customization }));
    });

    const reportsButton = screen.getByRole('button', { name: 'Service reports' });
    expect(reportsButton).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Battery overview' })).not.toBeInTheDocument();
    await user.click(reportsButton);
    expect(window.location.hash).toBe('#/reports');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Service reports');
  });

  it('removes disabled modules from navigation without deleting application records', () => {
    renderApp();
    const customization = JSON.parse(JSON.stringify(DEFAULT_CUSTOMIZATION)) as typeof DEFAULT_CUSTOMIZATION;
    const aiModule = customization.modules.find((item) => item.id === 'ai');
    if (!aiModule) throw new Error('Expected AI module preference is missing.');
    aiModule.enabled = false;

    act(() => {
      window.dispatchEvent(new CustomEvent('shuttle-customization-change', { detail: customization }));
    });

    expect(screen.queryByRole('button', { name: 'AI Technical Assistant' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem('shuttle-car-automation-v7:shuttles')).toBeTruthy();
  });

  it('applies compact sizing to the fleet dashboard widget', () => {
    const { container } = renderApp();
    const customization = JSON.parse(JSON.stringify(DEFAULT_CUSTOMIZATION)) as typeof DEFAULT_CUSTOMIZATION;
    const fleetWidget = customization.dashboard.find((item) => item.id === 'fleet-status');
    if (!fleetWidget) throw new Error('Default fleet widget preference is missing.');
    fleetWidget.size = 'compact';

    act(() => {
      window.dispatchEvent(new CustomEvent('shuttle-customization-change', { detail: customization }));
    });

    const renderedWidget = container.querySelector('.dashboard-fleet-widget');
    expect(renderedWidget).toBeInTheDocument();
    expect(renderedWidget).not.toHaveClass('dashboard-widget-wide');
  });

  it('edits, resolves, archives and restores a fault report without deleting corrective action', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Fault & Diagnostics/i })[0]);
    await user.type(screen.getByLabelText(/Fault title/i), 'Test bearing inspection');
    await user.type(screen.getByLabelText(/Observed symptom/i), 'Newly observed vibration during manual inspection');
    await user.click(screen.getByRole('button', { name: /Register fault/i }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Edit report/i }).length).toBeGreaterThan(0));

    const editButtons = screen.getAllByRole('button', { name: /Edit report/i });
    await user.click(editButtons[0]);
    const titleInputs = screen.getAllByLabelText(/Fault title/i);
    await user.clear(titleInputs[0]);
    await user.type(titleInputs[0], 'Updated bearing inspection');
    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    await waitFor(() => expect(screen.getByText('Updated bearing inspection')).toBeInTheDocument());

    const actionFields = screen.getAllByPlaceholderText(/corrective action/i);
    await user.type(actionFields[0], 'Inspected bearing and recorded measured clearance; technician verification completed.');
    await user.click(screen.getAllByRole('button', { name: /Save corrective action/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /Start investigation/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /Resolve/i })[0]);
    await waitFor(() => expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getAllByRole('button', { name: /Archive/i })[0]);
    confirmSpy.mockRestore();

    await waitFor(() => expect(screen.queryByText('Updated bearing inspection')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Show archived faults/i }));
    expect(screen.getByText(/Updated bearing inspection/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Restore/i }));
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:faults') || '[]') as Array<{title:string;archivedAt?:string|null;correctiveAction?:string}>;
      expect(saved.find(item => item.title === 'Updated bearing inspection')).toMatchObject({
        archivedAt: null,
        correctiveAction: 'Inspected bearing and recorded measured clearance; technician verification completed.'
      });
    });
  });

  it('edits and archives completed maintenance orders but keeps unfinished orders active', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Maintenance Management/i })[0]);
    await user.type(screen.getByLabelText(/Work order title/i), 'Drive assembly inspection');
    await user.type(screen.getByLabelText(/Scheduled date/i), '2026-11-25');
    await user.click(screen.getByRole('button', { name: /Save work order/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Edit order/i })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Edit order/i }));
    const title = screen.getAllByLabelText(/Work order title/i)[0];
    await user.clear(title);
    await user.type(title, 'Updated drive inspection');
    await user.click(screen.getByRole('button', { name: /Save changes/i }));
    await waitFor(() => expect(screen.getByText('Updated drive inspection')).toBeInTheDocument());

    await user.click(screen.getAllByRole('button', { name: /Start job/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /Complete job/i })[0]);
    await user.type(screen.getByLabelText(/Completion result \/ work performed/i), 'Inspected gearbox mount and verified fastener torque.');
    await user.click(screen.getByRole('button', { name: /Save result & complete/i }));
    await waitFor(() => expect(screen.getByText(/Completion result: Inspected gearbox mount and verified fastener torque/i)).toBeInTheDocument());
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getAllByRole('button', { name: /Archive/i })[0]);
    confirmSpy.mockRestore();

    await waitFor(() => {
      expect(screen.queryByText('Updated drive inspection')).not.toBeInTheDocument();
      const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:maintenance') || '[]') as Array<{title:string;status:string;archivedAt?:string|null}>;
      expect(saved.find(item => item.title === 'Updated drive inspection')?.archivedAt).toEqual(expect.any(String));
    });
    await user.click(screen.getByRole('button', { name: /Show archived work orders/i }));
    expect(screen.getByText(/Updated drive inspection/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Restore/i }));
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:maintenance') || '[]') as Array<{title:string;status:string;archivedAt?:string|null}>;
      expect(saved.find(item => item.title === 'Updated drive inspection')).toMatchObject({ status:'Completed', archivedAt:null });
    });
  });

  it('manages connection register entries locally without claiming live connectivity', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getAllByRole('button', { name: /Device Connections/i })[0]);
    await user.type(screen.getByLabelText(/Connection name/i), 'Test vendor gateway');
    await user.selectOptions(screen.getByLabelText(/^Protocol$/i), 'OPC UA');
    await user.type(screen.getByLabelText(/Technical notes/i), 'Vendor approved read-only interface reference pending');
    await user.click(screen.getByRole('button', { name: /Save connection record/i }));

    await waitFor(() => expect(screen.getByText('Test vendor gateway')).toBeInTheDocument());
    expect(screen.getAllByText(/Not configured · read-only after commissioning/i).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole('button', { name: /Edit record/i }).find(button => button.closest('article')?.textContent?.includes('Test vendor gateway'))!);
    const editName = screen.getAllByLabelText(/Connection name/i).find(input => (input as HTMLInputElement).value === 'Test vendor gateway');
    expect(editName).toBeTruthy();
    await user.clear(editName!);
    await user.type(editName!, 'Approved test gateway');
    await user.click(screen.getByRole('button', { name: /^Save$/i }));
    await waitFor(() => expect(screen.getByText('Approved test gateway')).toBeInTheDocument());

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const card = screen.getByText('Approved test gateway').closest('article');
    await user.click(card!.querySelector('button.btn-danger')!);
    confirmSpy.mockRestore();
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:connections') || '[]') as Array<{name:string;protocol:string;mode:string;archivedAt?:string|null}>;
      expect(saved.find(item => item.name === 'Approved test gateway')?.archivedAt).toEqual(expect.any(String));
    });
    await user.click(screen.getByRole('button', { name: /Show archived connection records/i }));
    expect(screen.getByText('Approved test gateway')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Restore/i })[0]);

    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem('shuttle-car-automation-v7:connections') || '[]') as Array<{name:string;protocol:string;mode:string;archivedAt?:string|null}>;
      expect(saved.find(item => item.name === 'Approved test gateway')).toMatchObject({ protocol:'OPC UA', mode:'UNKNOWN', archivedAt:null });
    });
  });

});
