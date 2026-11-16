import React, { useEffect, useMemo, useState } from 'react';
import { defaultSettings, initialBatteries, initialConnections, initialFaults, initialMaintenance, initialNotifications, initialShuttles, users } from './data/mockData';
import type {
  AppSettings,
  Battery,
  ConnectivityStatus,
  Fault,
  Language,
  MaintenanceJob,
  NotificationItem,
  Role,
  Shuttle,
  ShuttleStatus,
  Theme,
  User
} from './types';

const labels = {
  en: {
    dashboard: 'Dashboard',
    fleet: 'Fleet Control Center',
    engineering: 'Engineering Visualization',
    batteries: 'Battery Management',
    faults: 'Fault & Diagnostics',
    maintenance: 'Maintenance Management',
    ai: 'AI Technical Assistant',
    connections: 'Device Connections',
    reports: 'Reports Center',
    notifications: 'Notifications',
    users: 'Users & Security',
    settings: 'System Settings',
    totalShuttleCars: 'Total shuttle cars',
    running: 'Running shuttles',
    idle: 'Idle shuttles',
    charging: 'Charging shuttles',
    maintenanceShuttles: 'Maintenance shuttles',
    faulted: 'Faulted shuttles',
    disconnected: 'Disconnected shuttles',
    batteryOverview: 'Battery overview',
    activeFaults: 'Active faults',
    maintenanceAlerts: 'Maintenance alerts',
    recentEvents: 'Recent events',
    communicationStatus: 'System communication status',
    fleetActivity: 'Fleet activity visualization',
    ready: 'Ready',
    language: 'Language',
    theme: 'Theme',
    userStatus: 'Current user',
    resetRole: 'Reset preview role',
    systemNotice: 'HYPOTHESIS — REQUIRES TECHNICAL VERIFICATION',
    noOverride: 'No live hardware command is issued from this interface.'
  },
  ar: {
    dashboard: 'لوحة القيادة',
    fleet: 'مركز التحكم في الأساطيل',
    engineering: 'تصور الهندسة',
    batteries: 'إدارة البطاريات',
    faults: 'الأعطال والتشخيص',
    maintenance: 'إدارة الصيانة',
    ai: 'المساعد الفني بالذكاء الاصطناعي',
    connections: 'اتصالات الأجهزة',
    reports: 'مركز التقارير',
    notifications: 'الإشعارات',
    users: 'المستخدمون والأمان',
    settings: 'إعدادات النظام',
    totalShuttleCars: 'إجمالي عربات النقل',
    running: 'العربات العاملة',
    idle: 'العربات الخاملة',
    charging: 'العربات بالشحن',
    maintenanceShuttles: 'العربات في الصيانة',
    faulted: 'العربات المعطلة',
    disconnected: 'العربات المنقطعة',
    batteryOverview: 'نظرة عامة على البطاريات',
    activeFaults: 'الأعطال النشطة',
    maintenanceAlerts: 'تنبيهات الصيانة',
    recentEvents: 'الأحداث الأخيرة',
    communicationStatus: 'حالة الاتصال بالنظام',
    fleetActivity: 'تصور نشاط الأسطول',
    ready: 'جاهز',
    language: 'اللغة',
    theme: 'السمة',
    userStatus: 'المستخدم الحالي',
    resetRole: 'إعادة دور المعاينة',
    systemNotice: 'فرضية — تتطلب التحقق الفني',
    noOverride: 'لا يتم إصدار أي أمر حقيقي للمعدات من هذه الواجهة.'
  }
};

const navigation = [
  'dashboard',
  'fleet',
  'engineering',
  'batteries',
  'faults',
  'maintenance',
  'ai',
  'connections',
  'reports',
  'notifications',
  'users',
  'settings'
] as const;

type Tab = (typeof navigation)[number];

const defaultUser: User = { ...users[0], isAuthenticated: false };

const STORAGE_PREFIX = 'shuttle-car-automation-v6:';

function readLocalState<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

const statusColors: Record<ShuttleStatus, string> = {
  Ready: '#55d6a1',
  Running: '#59d9b2',
  Idle: '#f1c76c',
  Charging: '#7cb8ff',
  Maintenance: '#d89d5d',
  Fault: '#ff6b6b',
  Disconnected: '#9ea7ba',
  Unknown: '#a08cff'
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const canAccess = (user: User, tab: Tab) => {
  const permissions = user.role === 'Super Admin' ? navigation : user.role === 'Admin' ? navigation : user.role === 'Supervisor' ? ['dashboard','fleet','engineering','batteries','faults','maintenance','reports','notifications'] : user.role === 'Maintenance Engineer' ? ['dashboard','fleet','engineering','batteries','faults','maintenance','reports','notifications'] : user.role === 'Technician' ? ['dashboard','fleet','faults','maintenance','notifications'] : user.role === 'Operator' ? ['dashboard','fleet','notifications'] : ['dashboard', 'fleet'];
  return permissions.includes(tab);
};

const statCard = (title: string, value: number | string, accent: string) => (
  <div className="stat-card" key={title}>
    <div className="stat-label">{title}</div>
    <div className="stat-value" style={{ color: accent }}>{value}</div>
  </div>
);

function App() {
  const [language, setLanguage] = useState<Language>(() => readLocalState('language', 'en'));
  const [theme, setTheme] = useState<Theme>(() => readLocalState('theme', 'dark'));
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [currentUser, setCurrentUser] = useState<User>(defaultUser);
  const [shuttles, setShuttles] = useState<Shuttle[]>(() => readLocalState('shuttles', initialShuttles));
  const [batteries, setBatteries] = useState<Battery[]>(() => readLocalState('batteries', initialBatteries));
  const [faults, setFaults] = useState<Fault[]>(() => readLocalState('faults', initialFaults));
  const [maintenanceJobs, setMaintenanceJobs] = useState<MaintenanceJob[]>(() => readLocalState('maintenanceJobs', initialMaintenance));
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => readLocalState('notifications', initialNotifications));
  const [settings, setSettings] = useState<AppSettings>(() => readLocalState('settings', { ...defaultSettings }));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ShuttleStatus>('ALL');
  const [selectedShuttleId, setSelectedShuttleId] = useState(initialShuttles[0].id);
  const [selectedBatteryId, setSelectedBatteryId] = useState(initialBatteries[0].id);
  const [formState, setFormState] = useState({
    manufacturer: 'Cassioli',
    model: 'Representative Series',
    serialNumber: '',
    warehouseZone: '',
    status: 'Ready' as ShuttleStatus,
    connectivity: 'UNKNOWN' as ConnectivityStatus,
    assignedOperator: '',
    notes: ''
  });

  const t = labels[language];

  useEffect(() => {
    const persistedState: Record<string, unknown> = {
      language, theme, shuttles, batteries, faults, maintenanceJobs, notifications, settings
    };
    try {
      Object.entries(persistedState).forEach(([key, value]) => {
        window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
      });
    } catch {
      // The application remains usable if browser storage is unavailable or full.
    }
  }, [language, theme, shuttles, batteries, faults, maintenanceJobs, notifications, settings]);

  const dashboardStats = useMemo(() => {
    const total = shuttles.length;
    const running = shuttles.filter((s) => s.status === 'Running').length;
    const idle = shuttles.filter((s) => s.status === 'Idle').length;
    const charging = shuttles.filter((s) => s.status === 'Charging').length;
    const maintenance = shuttles.filter((s) => s.status === 'Maintenance').length;
    const faulted = shuttles.filter((s) => s.status === 'Fault').length;
    const disconnected = shuttles.filter((s) => s.status === 'Disconnected').length;
    const avgSoc = batteries.length ? Math.round(batteries.reduce((sum, item) => sum + item.soc, 0) / batteries.length) : 0;
    const activeFaultsCount = faults.filter((fault) => fault.status !== 'Resolved').length;
    const maintenanceAlerts = maintenanceJobs.filter((job) => job.status === 'Overdue').length;
    const recentEvents = [...faults, ...maintenanceJobs].slice(0, 4);

    return {
      total,
      running,
      idle,
      charging,
      maintenance,
      faulted,
      disconnected,
      avgSoc,
      activeFaultsCount,
      maintenanceAlerts,
      recentEvents
    };
  }, [batteries, faults, maintenanceJobs, shuttles]);

  const filteredShuttles = useMemo(() => {
    return shuttles.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const query = searchTerm.toLowerCase();
      const matchesText =
        item.id.toLowerCase().includes(query) ||
        item.manufacturer.toLowerCase().includes(query) ||
        item.warehouseZone.toLowerCase().includes(query) ||
        item.assignedOperator.toLowerCase().includes(query);
      return matchesStatus && matchesText;
    });
  }, [searchTerm, shuttles, statusFilter]);

  const selectedShuttle = shuttles.find((item) => item.id === selectedShuttleId) ?? shuttles[0];
  const selectedBattery = batteries.find((item) => item.id === selectedBatteryId) ?? batteries[0];

  const updateShuttleStatus = (id: string, status: ShuttleStatus) => {
    setShuttles((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const updateBatteryStatus = (id: string, status: Battery['status']) => {
    setBatteries((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const updateFaultStatus = (id: string, status: Fault['status']) => {
    setFaults((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      if (status === 'Resolved' && !item.correctiveAction?.trim()) return item;
      return { ...item, status };
    }));
  };

  const recordCorrectiveAction = (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const correctiveAction = String(formData.get('correctiveAction') || '').trim();
    if (!correctiveAction) return;
    setFaults((prev) => prev.map((item) => item.id === id ? { ...item, correctiveAction } : item));
    event.currentTarget.reset();
  };

  const updateMaintenanceStatus = (id: string, status: MaintenanceJob['status']) => {
    setMaintenanceJobs((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const addShuttle = (event: React.FormEvent) => {
    event.preventDefault();
    const newId = `SC-${Math.floor(600 + Math.random() * 250)}`;
    const record: Shuttle = {
      id: newId,
      manufacturer: formState.manufacturer as Shuttle['manufacturer'],
      model: formState.model,
      serialNumber: formState.serialNumber || `${newId}-SER`,
      hardwareVersion: 'HV1.0',
      firmwareVersion: 'FW-Next',
      warehouseZone: formState.warehouseZone || 'New zone',
      status: formState.status,
      connectivity: formState.connectivity as Shuttle['connectivity'],
      installedBattery: `BAT-${newId.slice(-3)}`,
      operatingHours: 0,
      operatingCycles: 0,
      faultHistory: [],
      maintenanceHistory: [],
      assignedOperator: formState.assignedOperator || 'Unassigned',
      lastCommunication: new Date().toISOString(),
      notes: formState.notes || 'New shuttle added to fleet.'
    };
    setShuttles((prev) => [record, ...prev]);
    setSelectedShuttleId(newId);
    setFormState({
      manufacturer: 'Cassioli',
      model: 'Representative Series',
      serialNumber: '',
      warehouseZone: '',
      status: 'Ready',
      connectivity: 'UNKNOWN',
      assignedOperator: '',
      notes: ''
    });
  };

  const addFault = (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const shuttleId = String(formData.get('shuttleId') || shuttles[0].id);
    const title = String(formData.get('title') || 'New diagnostic event');
    const severity = String(formData.get('severity') || 'Moderate');
    const description = String(formData.get('description') || 'Investigative note');
    const technician = String(formData.get('technician') || 'Maintenance Team');
    const probableCauses = [String(formData.get('cause1') || 'Unknown cause')];
    const diagnosticProcedure = String(formData.get('diagnosticProcedure') || 'Field review required');
    const correctiveAction = String(formData.get('correctiveAction') || '');

    const newFault: Fault = {
      id: `FLT-${Date.now()}`,
      shuttleId,
      title,
      severity: severity as Fault['severity'],
      status: 'Open',
      timestamp: new Date().toISOString(),
      description,
      probableCauses,
      diagnosticProcedure,
      correctiveAction: correctiveAction || undefined,
      assignedTechnician: technician
    };

    if (newFault.status === 'Resolved' && !newFault.correctiveAction) {
      return;
    }

    setFaults((prev) => [newFault, ...prev]);
    form.reset();
  };

  const addMaintenanceJob = (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const newJob: MaintenanceJob = {
      id: `MNT-${Date.now()}`,
      shuttleId: String(formData.get('shuttleId') || shuttles[0].id),
      title: String(formData.get('title') || 'Service event'),
      type: (String(formData.get('type') || 'Preventive') as MaintenanceJob['type']),
      status: (String(formData.get('status') || 'Scheduled') as MaintenanceJob['status']),
      scheduledDate: String(formData.get('scheduledDate') || new Date().toISOString().split('T')[0]),
      technician: String(formData.get('technician') || 'Unassigned'),
      notes: String(formData.get('notes') || 'Inspection required.')
    };
    setMaintenanceJobs((prev) => [newJob, ...prev]);
    form.reset();
  };

  const liveReports = [
    {
      title: 'Fleet status',
      value: `${shuttles.length ? Math.round((shuttles.filter((item) => ['Ready', 'Running', 'Idle', 'Charging'].includes(item.status)).length / shuttles.length) * 100) : 0}%`,
      detail: 'Share of fleet not currently faulted, disconnected, or under maintenance.'
    },
    {
      title: 'Battery health',
      value: `${batteries.length ? Math.round(batteries.reduce((sum, item) => sum + item.soh, 0) / batteries.length) : 0}%`,
      detail: 'Average illustrative SOH across current records; not live telemetry.'
    },
    {
      title: 'Active faults',
      value: String(faults.filter((item) => item.status !== 'Resolved').length),
      detail: 'Fault records still open or under investigation.'
    },
    {
      title: 'Maintenance backlog',
      value: String(maintenanceJobs.filter((item) => item.status !== 'Completed').length),
      detail: 'Work orders not yet marked completed.'
    }
  ];

  const handleDownloadCsv = () => {
    // Export current in-memory records. Seed values remain explicitly demonstrational,
    // and this file is a local snapshot rather than a live plant data extract.
    const header = [
      'Record Type', 'Record ID', 'Asset / Shuttle ID', 'Manufacturer / Type',
      'Model / Title', 'Status', 'Connectivity / Severity', 'Zone / Assignment',
      'Battery / Technician', 'SOC %', 'SOH %', 'Temperature C',
      'Operating Hours', 'Operating Cycles', 'Scheduled / Event Date',
      'Last Communication', 'Description / Notes', 'Data Provenance'
    ];

    const rows: string[][] = [
      ...shuttles.map((item) => [
        'Shuttle', item.id, item.id, item.manufacturer, item.model, item.status,
        item.connectivity, item.warehouseZone, item.installedBattery, '', '', '',
        String(item.operatingHours), String(item.operatingCycles), '',
        item.lastCommunication, item.notes, 'DEMO / MANUAL APP STATE — NOT LIVE TELEMETRY'
      ]),
      ...batteries.map((item) => [
        'Battery', item.id, item.assignment, item.manufacturer, item.model, item.status,
        item.connectionMode, item.assignment, '', String(item.soc), String(item.soh),
        String(item.temperature), '', '', item.lastMaintenance, '',
        item.notes, 'ILLUSTRATIVE / UNVERIFIED — NOT LIVE BATTERY TELEMETRY'
      ]),
      ...faults.map((item) => [
        'Fault', item.id, item.shuttleId, '', item.title, item.status, item.severity,
        '', item.assignedTechnician, '', '', '', '', '', item.timestamp, '',
        [item.description, `Probable causes: ${item.probableCauses.join('; ')}`,
          `Diagnostic procedure: ${item.diagnosticProcedure}`,
          `Corrective action: ${item.correctiveAction || 'Not recorded'}`].join(' | '),
        'DEMO / MANUAL APP STATE — VERIFY IN FIELD'
      ]),
      ...maintenanceJobs.map((item) => [
        'Maintenance', item.id, item.shuttleId, item.type, item.title, item.status, '',
        '', item.technician, '', '', '', '', '', item.scheduledDate, '',
        item.notes, 'DEMO / MANUAL APP STATE — VERIFY IN FIELD'
      ])
    ];

    const escapeCsv = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shuttle-operations-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleRoleSwitch = (role: Role) => {
    const user = users.find((item) => item.role === role) ?? users[0];
    setCurrentUser({ ...user, isAuthenticated: false });
  };

  const systemSummary = [
    { label: 'Real', value: shuttles.filter((item) => item.connectivity === 'REAL').length },
    { label: 'Simulation', value: shuttles.filter((item) => item.connectivity === 'SIMULATION').length },
    { label: 'Offline', value: shuttles.filter((item) => item.connectivity === 'OFFLINE').length },
    { label: 'Unknown', value: shuttles.filter((item) => item.connectivity === 'UNKNOWN').length }
  ];

  return (
    <div className={`app-shell ${theme}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-pill">SCA</div>
          <div>
            <strong>Shuttle Car</strong>
            <div>Automation V6</div>
          </div>
        </div>
        <nav className="nav-links">
          {navigation.map((tab) => {
            if (!canAccess(currentUser, tab)) return null;
            return (
              <button
                key={tab}
                className={`nav-button ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {t[tab as keyof typeof t] || tab}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <div className="eyebrow">{t.userStatus}</div>
            <strong>{currentUser.name}</strong> · {currentUser.role}
          </div>
          <div className="header-actions">
            <div className="segmented-control">
              <button className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')}>English</button>
              <button className={language === 'ar' ? 'active' : ''} onClick={() => setLanguage('ar')}>Arabic</button>
            </div>
            <button className="theme-toggle" onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}>
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button className="ghost-button" onClick={() => setCurrentUser(defaultUser)}>{t.resetRole}</button>
          </div>
        </header>

        <div className="notice-box warning" role="status" aria-live="polite">
          {language === 'ar'
            ? 'وضع تجريبي: البيانات المعروضة توضيحية أو مُدخلة يدويًا، والتغييرات محلية داخل الواجهة فقط. لا يوجد اتصال حي بالمعدات، وتبديل الأدوار ليس نظام صلاحيات أو تسجيل دخول حقيقي.'
            : 'DEMO MODE: records are illustrative or manually entered; changes exist only in this UI session. No live equipment connection is active, and role switching is not real authentication or server-enforced authorization.'}
        </div>

        {activeTab === 'dashboard' && (
          <section className="panel-grid">
            <div className="stats-grid">
              {statCard(t.totalShuttleCars, dashboardStats.total, '#8dd9ff')}
              {statCard(t.running, dashboardStats.running, '#6df0b1')}
              {statCard(t.idle, dashboardStats.idle, '#f0d475')}
              {statCard(t.charging, dashboardStats.charging, '#89bfff')}
              {statCard(t.maintenanceShuttles, dashboardStats.maintenance, '#f0a156')}
              {statCard(t.faulted, dashboardStats.faulted, '#ff7d7d')}
              {statCard(t.disconnected, dashboardStats.disconnected, '#b7bfd4')}
              {statCard(t.batteryOverview, `${dashboardStats.avgSoc}%`, '#7fd7a8')}
              {statCard(t.activeFaults, dashboardStats.activeFaultsCount, '#ff8f8f')}
              {statCard(t.maintenanceAlerts, dashboardStats.maintenanceAlerts, '#f8bd5e')}
            </div>

            <div className="half-grid">
              <div className="panel-card">
                <div className="card-title">{t.recentEvents}</div>
                <ul className="event-list">
                  {dashboardStats.recentEvents.map((item) => (
                    <li key={item.id}>
                      <span className="event-dot" />
                      <div>
                        <strong>{item.title || 'Event'}</strong>
                        <div>{'description' in item ? item.description : item.notes}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel-card">
                <div className="card-title">{t.communicationStatus}</div>
                <div className="status-stack">
                  {systemSummary.map((entry) => (
                    <div className="status-row" key={entry.label}>
                      <span>{entry.label}</span>
                      <strong>{entry.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel-card wide-card">
              <div className="card-title">{t.fleetActivity}</div>
              <div className="fleet-bar-chart">
                {shuttles.map((item) => (
                  <div className="fleet-bar" key={item.id}>
                    <span>{item.id}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${Math.min(100, (item.operatingHours / 6000) * 100)}%`, background: statusColors[item.status] }} />
                    </div>
                    <small>{item.status}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'fleet' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="section-header">
                <h3>Fleet Control Center</h3>
                <div className="filter-row">
                  <input placeholder="Search ID / manufacturer / zone" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ShuttleStatus)}>
                    <option value="ALL">All states</option>
                    <option value="Ready">Ready</option>
                    <option value="Running">Running</option>
                    <option value="Idle">Idle</option>
                    <option value="Charging">Charging</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Fault">Fault</option>
                    <option value="Disconnected">Disconnected</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Manufacturer</th>
                      <th>Model</th>
                      <th>Status</th>
                      <th>Operator</th>
                      <th>Zone</th>
                      <th>Communication</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShuttles.map((item) => (
                      <tr key={item.id} className={selectedShuttleId === item.id ? 'selected-row' : ''} onClick={() => setSelectedShuttleId(item.id)}>
                        <td>{item.id}</td>
                        <td>{item.manufacturer}</td>
                        <td>{item.model}</td>
                        <td>
                          <span className="badge" style={{ background: statusColors[item.status] }}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.assignedOperator}</td>
                        <td>{item.warehouseZone}</td>
                        <td>{item.connectivity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel-card">
              <div className="section-header">
                <h3>Shuttle record</h3>
                <button className="ghost-button" onClick={() => updateShuttleStatus(selectedShuttle.id, 'Ready')}>Set Ready</button>
              </div>
              {selectedShuttle && (
                <div className="record-grid">
                  <div><label>ID</label><div>{selectedShuttle.id}</div></div>
                  <div><label>Manufacturer</label><div>{selectedShuttle.manufacturer}</div></div>
                  <div><label>Model</label><div>{selectedShuttle.model}</div></div>
                  <div><label>Serial</label><div>{selectedShuttle.serialNumber}</div></div>
                  <div><label>Hardware</label><div>{selectedShuttle.hardwareVersion}</div></div>
                  <div><label>Firmware</label><div>{selectedShuttle.firmwareVersion}</div></div>
                  <div><label>Zone</label><div>{selectedShuttle.warehouseZone}</div></div>
                  <div><label>Status</label><div className="badge" style={{ background: statusColors[selectedShuttle.status] }}>{selectedShuttle.status}</div></div>
                  <div><label>Battery</label><div>{selectedShuttle.installedBattery}</div></div>
                  <div><label>Hours</label><div>{selectedShuttle.operatingHours}</div></div>
                  <div><label>Cycles</label><div>{selectedShuttle.operatingCycles}</div></div>
                  <div><label>Last communication</label><div>{formatDate(selectedShuttle.lastCommunication)}</div></div>
                </div>
              )}
            </div>
            <div className="panel-card">
              <div className="card-title">Add shuttle</div>
              <form className="stack-form" onSubmit={addShuttle}>
                <div className="form-two-col">
                  <input placeholder="Manufacturer" value={formState.manufacturer} onChange={(e) => setFormState({ ...formState, manufacturer: e.target.value })} />
                  <input placeholder="Model" value={formState.model} onChange={(e) => setFormState({ ...formState, model: e.target.value })} />
                  <input placeholder="Serial number" value={formState.serialNumber} onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })} />
                  <input placeholder="Warehouse / zone" value={formState.warehouseZone} onChange={(e) => setFormState({ ...formState, warehouseZone: e.target.value })} />
                  <select value={formState.status} onChange={(e) => setFormState({ ...formState, status: e.target.value as ShuttleStatus })}>
                    <option value="Ready">Ready</option>
                    <option value="Running">Running</option>
                    <option value="Idle">Idle</option>
                    <option value="Charging">Charging</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Fault">Fault</option>
                    <option value="Disconnected">Disconnected</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                  <select value={formState.connectivity} onChange={(e) => setFormState({ ...formState, connectivity: e.target.value as any })}>
                    <option value="REAL">REAL</option>
                    <option value="SIMULATION">SIMULATION</option>
                    <option value="OFFLINE">OFFLINE</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                  <input placeholder="Assigned operator" value={formState.assignedOperator} onChange={(e) => setFormState({ ...formState, assignedOperator: e.target.value })} />
                  <textarea placeholder="Technical notes" value={formState.notes} onChange={(e) => setFormState({ ...formState, notes: e.target.value })} />
                </div>
                <button type="submit" className="primary-button">Add shuttle</button>
              </form>
            </div>
          </section>
        )}

        {activeTab === 'engineering' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="section-header">
                <h3>Engineering Visualization Center</h3>
                <select value={selectedShuttleId} onChange={(e) => setSelectedShuttleId(e.target.value)}>
                  {shuttles.map((shuttle) => (
                    <option key={shuttle.id} value={shuttle.id}>{shuttle.id}</option>
                  ))}
                </select>
              </div>
              <EngineeringView shuttle={selectedShuttle} />
            </div>
            <div className="panel-card">
              <div className="card-title">Representative model details</div>
              <ul className="bullet-list">
                <li>3D isometric view / representative engineering model</li>
                <li>Front, side, and top view</li>
                <li>Battery installation position</li>
                <li>Wheel and drive arrangement</li>
                <li>Motor and sensor locations</li>
                <li>Status overlays rendered from live shuttle state</li>
              </ul>
              <div className="notice-box">{t.systemNotice}</div>
              <div className="small-text">{t.noOverride}</div>
            </div>
          </section>
        )}

        {activeTab === 'batteries' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="card-title">Battery inventory</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>State</th>
                      <th>SOC</th>
                      <th>SOH</th>
                      <th>Temp</th>
                      <th>Voltage</th>
                      <th>Assignment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batteries.map((battery) => (
                      <tr key={battery.id} className={selectedBatteryId === battery.id ? 'selected-row' : ''} onClick={() => setSelectedBatteryId(battery.id)}>
                        <td>{battery.id}</td>
                        <td>{battery.status}</td>
                        <td>{battery.soc}%</td>
                        <td>{battery.soh}%</td>
                        <td>{battery.temperature}°C</td>
                        <td>{battery.voltage}V</td>
                        <td>{battery.assignment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel-card">
              <div className="card-title">Battery engineering visualization</div>
              <BatteryVisualization battery={selectedBattery} />
              {selectedBattery && (
                <>
                  <div className="filter-row battery-actions">
                    <button type="button" className="ghost-button" onClick={() => updateBatteryStatus(selectedBattery.id, 'Charging')}>Set charging</button>
                    <button type="button" className="ghost-button" onClick={() => updateBatteryStatus(selectedBattery.id, 'Available')}>Set available</button>
                    <button type="button" className="ghost-button" onClick={() => updateBatteryStatus(selectedBattery.id, 'Maintenance')}>Set maintenance</button>
                    <button type="button" className="ghost-button" onClick={() => updateBatteryStatus(selectedBattery.id, 'Fault')}>Flag fault</button>
                  </div>
                  <div className="small-text">Status changes are manual local records only. SOC, SOH, voltage and temperature remain illustrative until a verified battery data source is connected.</div>
                </>
              )}
            </div>
          </section>
        )}

        {activeTab === 'faults' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="card-title">Fault registration and diagnostics</div>
              <div className="fault-list">
                {faults.map((fault) => (
                  <div key={fault.id} className="fault-card">
                    <div className="fault-head">
                      <strong>{fault.title}</strong>
                      <span className="badge warn">{fault.severity}</span>
                      <span className="badge neutral">{fault.status}</span>
                    </div>
                    <div className="meta-line">{fault.shuttleId} · {fault.timestamp}</div>
                    <p>{fault.description}</p>
                    <div className="small-text">Probable causes: {fault.probableCauses.join(', ')}</div>
                    <div className="small-text">Diagnostic procedure: {fault.diagnosticProcedure}</div>
                    <div className="small-text">Corrective action: {fault.correctiveAction || 'No documented corrective action recorded — resolution blocked.'}</div>
                    <div className="small-text">Technician: {fault.assignedTechnician}</div>
                    {!fault.correctiveAction?.trim() && (
                      <form className="stack-form" onSubmit={(event) => recordCorrectiveAction(event, fault.id)}>
                        <textarea name="correctiveAction" placeholder="Document corrective action" required />
                        <button type="submit" className="ghost-button">Save corrective action</button>
                      </form>
                    )}
                    {fault.correctiveAction?.trim() && <div className="small-text">Recorded corrective action: {fault.correctiveAction}</div>}
                    <div className="filter-row">
                      <button type="button" className="ghost-button" disabled={fault.status === 'Investigating' || fault.status === 'Resolved'} onClick={() => updateFaultStatus(fault.id, 'Investigating')}>Start investigation</button>
                      <button type="button" className="ghost-button" disabled={fault.status === 'Resolved' || !fault.correctiveAction?.trim()} title={!fault.correctiveAction?.trim() ? 'Record corrective action before resolving this fault' : 'Resolve fault'} onClick={() => updateFaultStatus(fault.id, 'Resolved')}>Resolve fault</button>
                    </div>
                    {!fault.correctiveAction?.trim() && <div className="small-text">Resolution is locked until a corrective action is documented.</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-card">
              <div className="card-title">Register fault</div>
              <form className="stack-form" onSubmit={addFault}>
                <select name="shuttleId">
                  {shuttles.map((shuttle) => <option key={shuttle.id} value={shuttle.id}>{shuttle.id}</option>)}
                </select>
                <input type="text" name="title" placeholder="Fault title" required />
                <select name="severity">
                  <option value="Critical">Critical</option>
                  <option value="Major">Major</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Minor">Minor</option>
                </select>
                <textarea name="description" placeholder="Technical description" required />
                <input type="text" name="cause1" placeholder="Probable cause" />
                <textarea name="diagnosticProcedure" placeholder="Diagnostic procedure" required />
                <textarea name="correctiveAction" placeholder="Document corrective action (required to resolve)" />
                <input type="text" name="technician" placeholder="Assigned technician" required />
                <button type="submit" className="primary-button">Register fault</button>
              </form>
            </div>
          </section>
        )}

        {activeTab === 'maintenance' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="card-title">Maintenance schedule</div>
              <div className="maintenance-list">
                {maintenanceJobs.map((job) => (
                  <div key={job.id} className="maintenance-card">
                    <div className="fault-head">
                      <strong>{job.title}</strong>
                      <span className="badge warn">{job.status}</span>
                    </div>
                    <div className="meta-line">{job.shuttleId} · {job.type}</div>
                    <div className="small-text">Date: {job.scheduledDate}</div>
                    <div className="small-text">Technician: {job.technician}</div>
                    <div className="small-text">Notes: {job.notes}</div>
                    <div className="filter-row">
                      <button type="button" className="ghost-button" disabled={job.status === 'In Progress' || job.status === 'Completed'} onClick={() => updateMaintenanceStatus(job.id, 'In Progress')}>Start job</button>
                      <button type="button" className="ghost-button" disabled={job.status === 'Completed'} onClick={() => updateMaintenanceStatus(job.id, 'Completed')}>Complete job</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-card">
              <div className="card-title">Create work order</div>
              <form className="stack-form" onSubmit={addMaintenanceJob}>
                <select name="shuttleId">
                  {shuttles.map((shuttle) => <option key={shuttle.id} value={shuttle.id}>{shuttle.id}</option>)}
                </select>
                <input type="text" name="title" placeholder="Work order title" required />
                <select name="type">
                  <option value="Preventive">Preventive</option>
                  <option value="Corrective">Corrective</option>
                </select>
                <select name="status">
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Overdue">Overdue</option>
                </select>
                <input type="date" name="scheduledDate" required />
                <input type="text" name="technician" placeholder="Technician" required />
                <textarea name="notes" placeholder="Maintenance notes" required />
                <button type="submit" className="primary-button">Create work order</button>
              </form>
            </div>
          </section>
        )}

        {activeTab === 'ai' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="card-title">AI Technical Assistant</div>
              <div className="assistant-box">
                <div className="small-text">{t.systemNotice}</div>
                <h4>Diagnosis summary</h4>
                <p>
                  For the Craftsman shuttle SC-204, the current anomaly is a pallet recognition issue and battery drain pattern. The assistant suggests a verification path that includes sensor alignment review, battery thermal scan, and a controlled test cycle. This remains a hypothesis and requires on-site engineering validation before any service recommendation is acted on.
                </p>
                <ul className="bullet-list">
                  <li>Review pallet-edge sensor calibration.</li>
                  <li>Inspect battery thermal behavior under load.</li>
                  <li>Run a safe test cycle and verify fault closure after corrective action.</li>
                </ul>
              </div>
            </div>
            <div className="panel-card">
              <div className="card-title">Diagnostic request</div>
              <form className="stack-form">
                <select>
                  {faults.map((fault) => <option key={fault.id} value={fault.id}>{fault.title}</option>)}
                </select>
                <textarea value="System review: battery behavior, communication anomalies, and maintenance history require field confirmation before final diagnosis." readOnly />
                <button type="button" className="primary-button" disabled title="AI provider is not configured">AI advisory unavailable</button>
                <div className="small-text">No AI service is connected. The diagnostic content above is a static illustrative checklist, not a generated diagnosis.</div>
              </form>
            </div>
          </section>
        )}

        {activeTab === 'connections' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="card-title">Device connection architecture</div>
              <div className="connection-grid">
                {initialConnections.map((endpoint) => (
                  <div key={endpoint.name} className="connection-card">
                    <div className="fault-head">
                      <strong>{endpoint.name}</strong>
                      <span className="badge neutral">{endpoint.mode}</span>
                    </div>
                    <div className="meta-line">{endpoint.protocol}</div>
                    <div className="small-text">{endpoint.notes}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-card">
              <div className="card-title">Adapter architecture</div>
              <ul className="bullet-list">
                <li>Modbus TCP</li>
                <li>OPC UA</li>
                <li>MQTT</li>
                <li>REST API</li>
                <li>WebSocket</li>
                <li>BLE</li>
                <li>Manufacturer SDKs and APIs</li>
              </ul>
              <div className="small-text">Only read-only monitoring lanes are active. No PLC addresses, credentials, or vendor endpoints are assumed in the application record.</div>
            </div>
          </section>
        )}

        {activeTab === 'reports' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="section-header">
                <h3>Operational reports</h3>
                <button className="primary-button" onClick={handleDownloadCsv}>Export CSV</button>
              </div>
              <div className="report-grid">
                {liveReports.map((report) => (
                  <div key={report.title} className="report-card">
                    <div className="small-text">{report.title}</div>
                    <div className="report-value">{report.value}</div>
                    <div className="small-text">{report.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'notifications' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="card-title">Active alerts</div>
              <div className="notification-list">
                {notifications.map((item) => (
                  <div key={item.id} className={`notice-box ${item.severity}`}>
                    <strong>{item.title}</strong>
                    <div>{item.detail}</div>
                    <small>{item.time}</small>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'users' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="card-title">Role-based access</div>
              <div className="user-list">
                {users.map((user) => (
                  <button key={user.id} className="user-row" onClick={() => handleRoleSwitch(user.role)}>
                    <div>
                      <strong>{user.name}</strong>
                      <div>{user.role}</div>
                    </div>
                    <span>{user.email}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="panel-card">
              <div className="card-title">Authentication</div>
              <div className="stack-form">
                <div className="notice-box warning">Authentication service is not configured. This screen does not accept credentials or create a secure session.</div>
                <div className="small-text">Use the role list only to preview client-side navigation. It is not an access-control test.</div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="panel-grid single-layer">
            <div className="panel-card">
              <div className="card-title">System settings</div>
              <div className="settings-list">
                <label><input type="checkbox" checked={settings.notificationsEnabled} onChange={() => setSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled })} /> Notifications enabled</label>
                <label><input type="checkbox" checked={settings.maintenanceReminders} onChange={() => setSettings({ ...settings, maintenanceReminders: !settings.maintenanceReminders })} /> Maintenance reminders</label>
                <label><input type="checkbox" checked={settings.batteryAlerts} onChange={() => setSettings({ ...settings, batteryAlerts: !settings.batteryAlerts })} /> Battery alerts</label>
                <label><input type="checkbox" checked={settings.communicationAlerts} onChange={() => setSettings({ ...settings, communicationAlerts: !settings.communicationAlerts })} /> Communication alerts</label>
              </div>
            </div>
            <div className="panel-card">
              <div className="card-title">Application</div>
              <div className="stack-form">
                <label>Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </select>
                <label>Theme</label>
                <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
                <button className="primary-button" type="button" disabled title="No backup service is configured">Backup unavailable</button>
                <div className="small-text">No export or backup destination is configured yet.</div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function EngineeringView({ shuttle }: { shuttle: Shuttle }) {
  return (
    <div className="engineering-layout">
      <div className="view-panels">
        <div className="view-panel">
          <div className="view-title">Isometric</div>
          <svg viewBox="0 0 220 180" className="vehicle-svg">
            <rect x="30" y="55" width="140" height="75" rx="12" fill="#374151" opacity="0.95" />
            <rect x="78" y="32" width="45" height="22" fill="#b9c6d9" />
            <rect x="55" y="65" width="25" height="15" fill="#f59e0b" />
            <rect x="135" y="65" width="25" height="15" fill="#f59e0b" />
            <circle cx="60" cy="132" r="18" fill="#111827" />
            <circle cx="145" cy="132" r="18" fill="#111827" />
            <circle cx="60" cy="132" r="7" fill="#9ca3af" />
            <circle cx="145" cy="132" r="7" fill="#9ca3af" />
            <path d="M10 85 L30 55" stroke="#d8dee7" strokeWidth="2"/>
            <path d="M170 85 L190 55" stroke="#d8dee7" strokeWidth="2"/>
          </svg>
        </div>
        <div className="view-panel">
          <div className="view-title">Front</div>
          <svg viewBox="0 0 220 180" className="vehicle-svg">
            <rect x="40" y="50" width="140" height="80" rx="12" fill="#374151" />
            <rect x="72" y="28" width="76" height="25" fill="#dfe7f3" />
            <rect x="62" y="66" width="20" height="16" fill="#f59e0b" />
            <rect x="138" y="66" width="20" height="16" fill="#f59e0b" />
            <circle cx="70" cy="135" r="14" fill="#111827" />
            <circle cx="150" cy="135" r="14" fill="#111827" />
          </svg>
        </div>
        <div className="view-panel">
          <div className="view-title">Top</div>
          <svg viewBox="0 0 220 180" className="vehicle-svg">
            <rect x="20" y="70" width="180" height="55" rx="10" fill="#374151" />
            <line x1="60" y1="70" x2="60" y2="125" stroke="#cbd5e1" />
            <line x1="100" y1="70" x2="100" y2="125" stroke="#cbd5e1" />
            <line x1="140" y1="70" x2="140" y2="125" stroke="#cbd5e1" />
            <line x1="180" y1="70" x2="180" y2="125" stroke="#cbd5e1" />
          </svg>
        </div>
      </div>
      <div className="spec-sheet">
        <div className="spec-row"><span>Shuttle</span><strong>{shuttle.id}</strong></div>
        <div className="spec-row"><span>Manufacturer</span><strong>{shuttle.manufacturer}</strong></div>
        <div className="spec-row"><span>Model</span><strong>{shuttle.model}</strong></div>
        <div className="spec-row"><span>Operational status</span><strong>{shuttle.status}</strong></div>
        <div className="spec-row"><span>Battery</span><strong>{shuttle.installedBattery}</strong></div>
        <div className="spec-row"><span>Connectivity</span><strong>{shuttle.connectivity}</strong></div>
      </div>
    </div>
  );
}

function BatteryVisualization({ battery }: { battery: Battery }) {
  return (
    <div className="battery-visual">
      <div className="battery-outline">
        <div className="battery-top" />
        <div className="cell-grid">
          {Array.from({ length: 8 }).map((_, index) => (
            <div className="cell" key={index} style={{ opacity: 0.3 + (battery.soc / 100) * 0.7 }} />
          ))}
        </div>
        <div className="temperature-band">
          <span>Temp</span>
          <strong>{battery.temperature}°C</strong>
        </div>
      </div>
      <div className="spec-sheet">
        <div className="spec-row"><span>Battery</span><strong>{battery.id}</strong></div>
        <div className="spec-row"><span>SOH</span><strong>{battery.soh}%</strong></div>
        <div className="spec-row"><span>SOC</span><strong>{battery.soc}%</strong></div>
        <div className="spec-row"><span>Voltage</span><strong>{battery.voltage}V</strong></div>
        <div className="spec-row"><span>Current</span><strong>{battery.current}A</strong></div>
        <div className="spec-row"><span>Assignment</span><strong>{battery.assignment}</strong></div>
      </div>
    </div>
  );
}

export default App;
