import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultSettings,
  initialBatteries,
  initialConnections,
  initialFaults,
  initialMaintenance,
  initialNotifications,
  initialShuttles,
  users
} from './data/mockData';
import Shuttle3DViewer from './components/Shuttle3DViewer';
import Battery3DViewer from './components/Battery3DViewer';
import { getManufacturerReference } from './data/manufacturerReferences';
import type {
  AppSettings,
  Battery,
  Fault,
  Language,
  MaintenanceJob,
  NotificationItem,
  Role,
  Shuttle,
  ShuttleStatus,
  Theme,
  DailyReportSnapshot
} from './types';

type Tab = 'dashboard' | 'fleet' | 'engineering' | 'batteries' | 'faults' | 'maintenance' | 'connections' | 'ai' | 'reports' | 'notifications' | 'users' | 'settings';
type ModelView = 'iso' | 'side' | 'front' | 'top';
type EngineeringPart = 'chassis' | 'drive' | 'wheels' | 'battery' | 'sensors';

const navItems: { id: Tab; en: string; ar: string; icon: string; group: string }[] = [
  { id: 'dashboard', en: 'Dashboard', ar: 'لوحة القيادة', icon: 'grid', group: 'OPERATIONS' },
  { id: 'fleet', en: 'Fleet Control Center', ar: 'إدارة الأسطول', icon: 'truck', group: 'OPERATIONS' },
  { id: 'engineering', en: 'Engineering Visualization', ar: 'التصور الهندسي', icon: 'blueprint', group: 'ENGINEERING' },
  { id: 'batteries', en: 'Battery Management', ar: 'إدارة البطاريات', icon: 'battery', group: 'ENGINEERING' },
  { id: 'faults', en: 'Fault & Diagnostics', ar: 'الأعطال والتشخيص', icon: 'alert', group: 'ENGINEERING' },
  { id: 'maintenance', en: 'Maintenance Management', ar: 'إدارة الصيانة', icon: 'wrench', group: 'ENGINEERING' },
  { id: 'connections', en: 'Device Connections', ar: 'اتصالات المعدات', icon: 'network', group: 'SYSTEM' },
  { id: 'ai', en: 'AI Technical Assistant', ar: 'المساعد الفني', icon: 'spark', group: 'SYSTEM' },
  { id: 'reports', en: 'Reports Center', ar: 'مركز التقارير', icon: 'chart', group: 'SYSTEM' },
  { id: 'notifications', en: 'Notifications', ar: 'الإشعارات', icon: 'bell', group: 'SYSTEM' },
  { id: 'users', en: 'Users & Security', ar: 'المستخدمون والأمان', icon: 'users', group: 'ADMIN' },
  { id: 'settings', en: 'System Settings', ar: 'إعدادات النظام', icon: 'settings', group: 'ADMIN' }
];

const copy = {
  en: {
    appName: 'SHUTTLE OPERATIONS', subtitle: 'Industrial control & engineering suite',
    demo: 'DEMO MODE · LOCAL RECORDS', demoText: 'No live equipment connection: no shuttle is connected to live PLC or manufacturer telemetry. Values marked unverified are not machine readings.',
    total: 'Total shuttle cars', running: 'Running shuttles', idle: 'Idle / Ready', faulted: 'Fault records', disconnected: 'Offline / unknown', battery: 'Verified battery SOC',
    fleet: 'Fleet overview', fleetSub: 'Manage equipment identity, operating condition, assignment and service history.',
    engineering: 'Engineering visualization', engineeringSub: 'Interactive mechanical schematic with selectable views and component callouts.',
    selectAsset: 'Select shuttle', status: 'Operating state', manufacturer: 'Manufacturer', model: 'Model', serial: 'Serial number', zone: 'Operating zone', batteryPack: 'Installed battery', communication: 'Communication', lastSeen: 'Last communication',
    noData: 'Not recorded', unknown: 'Unknown / not verified', openFleet: 'Open fleet register', openEngineering: 'Open engineering view',
    modelDisclaimer: 'Conceptual engineering illustration — not manufacturer CAD or a scale-accurate machine model.',
    iso: 'Isometric', side: 'Side', front: 'Front', top: 'Top', exploded: 'Exploded view', animate: 'Animate mechanism', stop: 'Stop animation',
    componentLegend: 'Mechanical assemblies', chassis: 'Main chassis', drive: 'Drive motor & gearbox', wheel: 'Traction wheels', batteryComp: 'Removable battery tray', sensors: 'Sensors & safety zone',
    localChanges: 'Local simulation only. This action does not send commands to a shuttle.',
    search: 'Search by ID, manufacturer or zone', allStates: 'All states', addShuttle: 'Register shuttle', save: 'Save record', cancel: 'Cancel', notes: 'Technical notes',
    noBattery: 'No verified battery register is available yet.', batteryIllustration: 'Battery assembly illustration', charge: 'State of charge', health: 'State of health', temperature: 'Temperature', voltage: 'Voltage', current: 'Current', assignment: 'Assignment', batteryNote: 'Reported ACME HMI value: 0% after repair. Verify against the physical HMI before treating it as live telemetry.',
    setCharging: 'Set charging', setAvailable: 'Set available', setMaintenance: 'Set maintenance', setFault: 'Flag fault',
    faults: 'Fault register', faultSub: 'Record an observation, investigation and corrective action. Never close a fault without documenting the action.',
    faultTitle: 'Fault title', description: 'Observed symptom', severity: 'Severity', technician: 'Assigned technician', probableCause: 'Possible cause (unverified)', procedure: 'Inspection / test procedure', corrective: 'Document corrective action', registerFault: 'Register fault', saveAction: 'Save corrective action', investigate: 'Start investigation', resolve: 'Resolve fault',
    maintenance: 'Maintenance work orders', maintenanceSub: 'Plan inspections and record completed maintenance.', workTitle: 'Work order title', date: 'Scheduled date', createWork: 'Create work order', startWork: 'Start job', completeWork: 'Complete job',
    connectionSub: 'Protocol readiness is shown as architecture only. No endpoint, PLC address or vendor API has been configured.',
    aiSub: 'Engineering support checklist. AI service is not connected, so no diagnosis is generated automatically.',
    reportsSub: 'Export the current local register for review. Demonstration and unverified fields remain clearly marked.',
    exportCsv: 'Export CSV', backup: 'Download JSON backup', print: 'Print / Save PDF',
    noNotifications: 'No new local notifications.', noUsers: 'Role preview only — no real authentication or server-enforced permissions.',
    language: 'Language', theme: 'Appearance', dark: 'Dark', light: 'Light', role: 'Preview role', reset: 'Reset preview',
    statusReady: 'Ready', statusRunning: 'Running', statusIdle: 'Idle', statusCharging: 'Charging', statusMaintenance: 'Maintenance', statusFault: 'Fault', statusDisconnected: 'Disconnected', statusUnknown: 'Unknown',
    protocols: 'Protocol adapters', readOnly: 'Read-only integration first', noConnection: 'Not connected', notConfigured: 'Not configured',
    noFaults: 'No fault records. Add an observation when a fault is reported.', noWork: 'No work orders have been registered.',
    fleetState: 'Fleet state distribution', assetDetails: 'Asset details', selected: 'Selected asset', localId: 'Local asset ID',
    newFaults: 'Open / investigating faults', backlog: 'Open work orders', quickActions: 'Quick actions', systemState: 'System communication status', unverified: 'UNVERIFIED',
    viewRegister: 'View register', addFirst: 'Add first record', empty: 'No records available', testView: 'View engineering drawing',
    roleNotice: 'Changing this role only previews the navigation. It is not a secure login.',
    dataNotice: 'Data quality: manually reported or unknown. No invented serial numbers, firmware versions or live PLC values.',
    done: 'Saved locally', removeFilters: 'Clear filters'
  },
  ar: {
    appName: 'منظومة تشغيل الشاتل', subtitle: 'إدارة صناعية وتصميم هندسي',
    demo: 'وضع تجريبي / بيانات محلية', demoText: 'لا يوجد اتصال حي بوحدات التحكم أو بيانات الشركة المصنعة. أي قيمة غير مؤكدة ليست قراءة مباشرة من المعدة.',
    total: 'إجمالي عربات النقل', running: 'قيد التشغيل', idle: 'جاهز / متوقف', faulted: 'سجلات الأعطال', disconnected: 'غير متصل / غير معروف', battery: 'شحن بطارية مؤكد',
    fleet: 'ملخص الأسطول', fleetSub: 'إدارة بيانات المعدات وحالتها وتخصيصها وسجل الخدمة والصيانة.',
    engineering: 'التصور الهندسي', engineeringSub: 'رسم ميكانيكي تفاعلي مع أوضاع عرض متعددة وإظهار المكونات.',
    selectAsset: 'اختر العربة', status: 'حالة التشغيل', manufacturer: 'الشركة المصنعة', model: 'الموديل', serial: 'الرقم المسلسل', zone: 'منطقة التشغيل', batteryPack: 'البطارية المركبة', communication: 'الاتصال', lastSeen: 'آخر اتصال',
    noData: 'غير مسجل', unknown: 'غير معروف / لم يتم التحقق', openFleet: 'فتح سجل الأسطول', openEngineering: 'فتح التصور الهندسي',
    modelDisclaimer: 'رسم هندسي تصوري — ليس ملف CAD معتمدًا من الشركة المصنعة ولا نموذجًا مطابقًا للأبعاد.',
    iso: 'منظور مجسم', side: 'جانبي', front: 'أمامي', top: 'علوي', exploded: 'عرض تفكيكي', animate: 'تحريك الآلية', stop: 'إيقاف الحركة',
    componentLegend: 'المجموعات الميكانيكية', chassis: 'الشاسيه الرئيسي', drive: 'المحرك وعلبة التروس', wheel: 'عجلات الحركة', batteryComp: 'درج البطارية القابل للفك', sensors: 'الحساسات ومنطقة الأمان',
    localChanges: 'تغيير محلي تجريبي فقط. لا يتم إرسال أوامر إلى عربة الشاتل.',
    search: 'ابحث بالرقم أو الشركة أو المنطقة', allStates: 'كل الحالات', addShuttle: 'تسجيل عربة', save: 'حفظ السجل', cancel: 'إلغاء', notes: 'ملاحظات فنية',
    noBattery: 'لا يوجد حتى الآن سجل بطاريات موثق بالكامل.', batteryIllustration: 'رسم مجموعة البطارية', charge: 'مستوى الشحن', health: 'حالة البطارية', temperature: 'الحرارة', voltage: 'الجهد', current: 'التيار', assignment: 'التخصيص', batteryNote: 'قراءة مبلغ عنها من شاشة ACME: 0% بعد الإصلاح. يجب مراجعتها على شاشة المعدة قبل اعتبارها قراءة حية.',
    setCharging: 'تحديد: شحن', setAvailable: 'تحديد: متاحة', setMaintenance: 'تحديد: صيانة', setFault: 'تسجيل عطل',
    faults: 'سجل الأعطال', faultSub: 'سجل الملاحظة والفحص والإجراء التصحيحي. لا تغلق أي عطل قبل توثيق الإجراء.',
    faultTitle: 'عنوان العطل', description: 'العَرَض المشاهد', severity: 'الأهمية', technician: 'الفني المسؤول', probableCause: 'سبب محتمل (غير مؤكد)', procedure: 'خطوات الفحص والاختبار', corrective: 'الإجراء التصحيحي المنفذ', registerFault: 'تسجيل العطل', saveAction: 'حفظ الإجراء', investigate: 'بدء الفحص', resolve: 'إغلاق العطل',
    maintenance: 'أوامر الصيانة', maintenanceSub: 'جدولة الفحوصات وتوثيق الصيانة المنفذة.', workTitle: 'عنوان أمر الصيانة', date: 'موعد التنفيذ', createWork: 'إنشاء أمر صيانة', startWork: 'بدء المهمة', completeWork: 'إتمام المهمة',
    connectionSub: 'حالة البروتوكولات تمثل تصورًا معماريًا فقط. لم يتم إعداد عنوان جهاز أو واجهة مصنع أو اتصال PLC.',
    aiSub: 'قائمة مساعدة فنية. خدمة الذكاء الاصطناعي غير مربوطة، لذلك لا يتم توليد تشخيص تلقائي.',
    reportsSub: 'تصدير السجلات المحلية للمراجعة مع توضيح البيانات التجريبية وغير المؤكدة.',
    exportCsv: 'تصدير CSV', backup: 'تنزيل نسخة JSON', print: 'طباعة / حفظ PDF',
    noNotifications: 'لا توجد إشعارات محلية جديدة.', noUsers: 'معاينة أدوار فقط — لا يوجد تسجيل دخول حقيقي أو صلاحيات مؤمنة على خادم.',
    language: 'اللغة', theme: 'المظهر', dark: 'داكن', light: 'فاتح', role: 'معاينة الدور', reset: 'إعادة المعاينة',
    statusReady: 'جاهز', statusRunning: 'يعمل', statusIdle: 'متوقف', statusCharging: 'يشحن', statusMaintenance: 'صيانة', statusFault: 'عطل', statusDisconnected: 'غير متصل', statusUnknown: 'غير معروف',
    protocols: 'واجهات الاتصال', readOnly: 'البدء بالقراءة فقط', noConnection: 'غير متصل', notConfigured: 'غير مُعد',
    noFaults: 'لا توجد أعطال مسجلة. أضف ملاحظة عند الإبلاغ عن عطل.', noWork: 'لم يتم تسجيل أوامر صيانة بعد.',
    fleetState: 'توزيع حالات الأسطول', assetDetails: 'تفاصيل العربة', selected: 'العربة المختارة', localId: 'رقم داخلي',
    newFaults: 'أعطال مفتوحة / قيد الفحص', backlog: 'أوامر صيانة مفتوحة', quickActions: 'إجراءات سريعة', systemState: 'حالة اتصال النظام', unverified: 'غير مؤكد',
    viewRegister: 'عرض السجل', addFirst: 'إضافة أول سجل', empty: 'لا توجد سجلات', testView: 'عرض الرسم الهندسي',
    roleNotice: 'تغيير الدور يعرض شكل التنقل فقط، وليس تسجيل دخول آمن.',
    dataNotice: 'جودة البيانات: بلاغات يدوية أو حقول غير معروفة. لا توجد أرقام مسلسل أو إصدارات أو قراءات PLC مختلقة.',
    done: 'تم الحفظ محليًا', removeFilters: 'مسح الفلاتر'
  }
};

function tabFromLocation(): Tab {
  const hash = window.location.hash;
  const candidate = (hash.startsWith('#/') ? hash.slice(2) : hash.replace(/^#/, '')) as Tab;
  return navItems.some((item) => item.id === candidate) ? candidate : 'dashboard';
}

const PREFIX = 'shuttle-car-automation-v7:';
function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);

    // V7 stored zero-hour / zero-cycle placeholders for unverified shuttle records.
    // Convert only those legacy placeholders; preserve zero values from a verified source.
    if (key === 'shuttles' && Array.isArray(parsed)) {
      return parsed.map((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
        const shuttle = value as Partial<Shuttle>;
        const isUnverifiedPlaceholder =
          shuttle.model === 'Not recorded' &&
          shuttle.serialNumber === 'Not recorded' &&
          shuttle.connectivity === 'UNKNOWN' &&
          shuttle.status === 'Unknown';

        if (!isUnverifiedPlaceholder) return shuttle;
        return {
          ...shuttle,
          operatingHours: shuttle.operatingHours === 0 ? null : shuttle.operatingHours,
          operatingCycles: shuttle.operatingCycles === 0 ? null : shuttle.operatingCycles
        };
      }) as T;
    }

    return parsed as T;
  } catch {
    return fallback;
  }
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    truck: <><path d="M3 7h12v10H3z"/><path d="M15 10h4l3 3v4h-7z"/><circle cx="7.5" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>,
    blueprint: <><path d="M4 4h16v16H4z"/><path d="M8 4v5h5M4 14h6v6M14 13h6M14 17h6"/></>,
    battery: <><rect x="3" y="7" width="18" height="11" rx="2"/><path d="M7 7V5h4v2M8 11v3M12 11v3M16 11v3"/></>,
    alert: <><path d="M12 3 2.8 20h18.4L12 3z"/><path d="M12 9v5M12 17.5h.01"/></>,
    wrench: <><path d="M14 6a5 5 0 0 0-6.6 6.6L3 17l4 4 4.4-4.4A5 5 0 0 0 18 10l-3 3-4-4 3-3z"/></>,
    network: <><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="m10.7 7.2-4.4 9.5M13.3 7.2l4.4 9.5M7.5 19h9"/></>,
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/></>,
    chart: <><path d="M4 20V5M4 20h17"/><path d="m7 15 4-4 3 2 5-7"/></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1z"/><path d="M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 5v1"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2 2.1-2 2-2.2-1.2a7.5 7.5 0 0 1-1.8.7L14 21h-4l-.7-2.3a7.5 7.5 0 0 1-1.8-.7L5.3 19l-2-2 1.2-2.1a7.5 7.5 0 0 1-.7-1.9L1.5 12l2.3-2 .7-1.8L3.3 6l2-2 2.2 1.2a7.5 7.5 0 0 1 1.8-.7L10 2h4l.7 2.3a7.5 7.5 0 0 1 1.8.7L18.7 4l2 2-1.2 2.1a7.5 7.5 0 0 1 .7 1.9l2.3 2-2.3 2a7.5 7.5 0 0 1-.8 1z"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    arrow: <path d="M5 12h14M13 6l6 6-6 6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    check: <path d="m5 12 4 4L19 6"/>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" {...common}>{paths[name] || paths.grid}</svg>;
}

function StatusPill({ status, language }: { status: ShuttleStatus | string; language: Language }) {
  const map: Record<string, string> = language === 'ar'
    ? { Ready: 'جاهز', Running: 'يعمل', Idle: 'متوقف', Charging: 'يشحن', Maintenance: 'صيانة', Fault: 'عطل', Disconnected: 'غير متصل', Unknown: 'غير معروف', Open: 'مفتوح', Investigating: 'قيد الفحص', Resolved: 'تم الحل', Scheduled: 'مجدول', 'In Progress': 'قيد التنفيذ', Completed: 'مكتمل', Overdue: 'متأخر', Available: 'متاحة', Installed: 'مركبة' }
    : {};
  return <span className={'status-pill status-' + String(status).toLowerCase().replace(/ /g, '-')}>{map[status] || status}</span>;
}

function ShuttleModel({ shuttle, view, exploded, animated }: { shuttle: Shuttle; view: ModelView; exploded: boolean; animated: boolean }) {
  const accent = shuttle.manufacturer === 'Cassioli' ? '#d28b4b' : shuttle.manufacturer === 'Craftsman' ? '#45b8d2' : '#a58af5';
  const moving = animated && shuttle.status === 'Running';
  const wheelClass = moving ? 'model-wheel spinning' : 'model-wheel';
  if (view === 'side') return <svg className="shuttle-svg" viewBox="0 0 760 390" role="img" aria-label="Side engineering illustration of shuttle car">
    <defs><linearGradient id="sideMetal" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#667687"/><stop offset="1" stopColor="#202a35"/></linearGradient><linearGradient id="sideDeck"><stop stopColor="#8d9aa6"/><stop offset="1" stopColor="#3b4857"/></linearGradient></defs>
    <path className="floor-grid" d="M30 325H730M70 350H690M120 300l-70 50M250 300l-70 50M380 300l-70 50M510 300l-70 50M640 300l-70 50"/>
    <rect x="118" y="155" width="520" height="140" rx="24" fill="url(#sideMetal)" stroke="#9baabb" strokeWidth="3"/>
    <path d="M145 165h465v22H145z" fill={accent} opacity=".9"/><path d="M150 205h450v60H150z" fill="#1d2935" stroke="#708092" strokeWidth="2"/>
    <rect x={exploded ? 340 : 315} y={exploded ? 66 : 193} width="160" height="70" rx="12" fill="#9ba9b4" stroke="#d3dde5" strokeWidth="3"/>
    <rect x="335" y="205" width="118" height="45" rx="8" fill="#293744" stroke={accent} strokeWidth="3"/>
    {Array.from({length:6}).map((_,i)=><rect key={i} x={344+i*17} y="213" width="10" height="28" rx="3" fill={accent} opacity=".9"/>)}
    <rect x="170" y="193" width="88" height="54" rx="12" fill="#17232f" stroke="#8192a2" strokeWidth="3"/><circle cx="214" cy="220" r="21" fill="#d18a43"/><circle cx="214" cy="220" r="10" fill="#283542"/>
    <rect x="502" y="193" width="88" height="54" rx="12" fill="#17232f" stroke="#8192a2" strokeWidth="3"/><circle cx="546" cy="220" r="21" fill="#d18a43"/><circle cx="546" cy="220" r="10" fill="#283542"/>
    <g className={wheelClass}><circle cx="198" cy="294" r="42" fill="#101820" stroke="#8695a5" strokeWidth="8"/><circle cx="198" cy="294" r="17" fill="#445363" stroke="#b7c3cd" strokeWidth="3"/><path d="M198 260v68M164 294h68M174 270l48 48M222 270l-48 48" stroke="#8797a7" strokeWidth="4"/></g>
    <g className={wheelClass}><circle cx="560" cy="294" r="42" fill="#101820" stroke="#8695a5" strokeWidth="8"/><circle cx="560" cy="294" r="17" fill="#445363" stroke="#b7c3cd" strokeWidth="3"/><path d="M560 260v68M526 294h68M536 270l48 48M584 270l-48 48" stroke="#8797a7" strokeWidth="4"/></g>
    <rect x="270" y="143" width="220" height="15" rx="5" fill={accent}/><rect x="130" y="126" width="45" height="22" rx="7" fill="#f1b657"/><rect x="580" y="126" width="45" height="22" rx="7" fill="#f1b657"/>
    {exploded && <g className="callout"><path d="M410 65V30h130" /><text x="548" y="34">REMOVABLE BATTERY</text><path d="M215 220V90H80"/><text x="80" y="80">DRIVE MOTOR</text></g>}
    <text x="32" y="370" className="svg-caption">{shuttle.manufacturer.toUpperCase()} · SIDE ELEVATION</text>
  </svg>;
  if (view === 'front') return <svg className="shuttle-svg" viewBox="0 0 760 390" role="img" aria-label="Front engineering illustration of shuttle car">
    <path className="floor-grid" d="M40 325H720M80 350H680M150 300l-60 50M300 300l-60 50M450 300l-60 50M600 300l-60 50"/>
    <rect x="190" y="104" width="380" height="190" rx="22" fill="#344353" stroke="#9aaabb" strokeWidth="4"/>
    <path d="M215 118h330v24H215z" fill={accent}/><rect x="260" y="160" width="240" height="82" rx="15" fill="#1b2733" stroke="#8293a4" strokeWidth="3"/>
    <rect x="285" y="177" width="190" height="45" rx="8" fill="#455565"/><rect x="302" y="185" width="156" height="8" rx="4" fill={accent}/>
    <rect x="235" y="246" width="80" height="34" rx="12" fill="#18222d"/><rect x="445" y="246" width="80" height="34" rx="12" fill="#18222d"/>
    <g className={wheelClass}><circle cx="235" cy="294" r="45" fill="#0e1720" stroke="#8a9aaa" strokeWidth="8"/><circle cx="235" cy="294" r="18" fill="#566777"/><path d="M235 260v68M201 294h68" stroke="#aebdca" strokeWidth="4"/></g>
    <g className={wheelClass}><circle cx="525" cy="294" r="45" fill="#0e1720" stroke="#8a9aaa" strokeWidth="8"/><circle cx="525" cy="294" r="18" fill="#566777"/><path d="M525 260v68M491 294h68" stroke="#aebdca" strokeWidth="4"/></g>
    <circle cx="380" cy="153" r="9" fill="#75d6ff"/><circle cx="380" cy="153" r="17" fill="none" stroke="#75d6ff" opacity=".4"/>
    {exploded && <g className="callout"><path d="M380 153V55h130"/><text x="520" y="60">SAFETY SENSOR</text></g>}
    <text x="32" y="370" className="svg-caption">{shuttle.manufacturer.toUpperCase()} · FRONT ELEVATION</text>
  </svg>;
  if (view === 'top') return <svg className="shuttle-svg" viewBox="0 0 760 390" role="img" aria-label="Top engineering illustration of shuttle car">
    <path className="floor-grid" d="M30 325H730M80 350H680M140 40v290M290 40v290M440 40v290M590 40v290"/>
    <rect x="180" y="34" width="400" height="286" rx="30" fill="#344353" stroke="#a2b0bd" strokeWidth="4"/>
    <rect x="205" y="58" width="350" height="42" rx="12" fill={accent}/><rect x="226" y="122" width="308" height="125" rx="18" fill="#18232f" stroke="#8595a5" strokeWidth="3"/>
    <rect x="270" y="147" width="220" height="75" rx="10" fill="#8795a1" stroke="#d2dce5" strokeWidth="3"/>
    {Array.from({length:8}).map((_,i)=><rect key={i} x={280+i*26} y="157" width="16" height="55" rx="4" fill={accent}/>)}
    <rect x="138" y="83" width="42" height="76" rx="10" fill="#101923" stroke="#8c9baa" strokeWidth="3"/><rect x="580" y="83" width="42" height="76" rx="10" fill="#101923" stroke="#8c9baa" strokeWidth="3"/>
    <rect x="138" y="213" width="42" height="76" rx="10" fill="#101923" stroke="#8c9baa" strokeWidth="3"/><rect x="580" y="213" width="42" height="76" rx="10" fill="#101923" stroke="#8c9baa" strokeWidth="3"/>
    {exploded && <g className="callout"><path d="M380 180V16h135"/><text x="520" y="20">BATTERY MODULE</text></g>}
    <text x="32" y="370" className="svg-caption">{shuttle.manufacturer.toUpperCase()} · TOP PLAN</text>
  </svg>;
  return <svg className="shuttle-svg" viewBox="0 0 760 390" role="img" aria-label="Isometric engineering illustration of shuttle car">
    <defs>
      <linearGradient id="bodyTop" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9caab5"/><stop offset="1" stopColor="#455361"/></linearGradient>
      <linearGradient id="bodySide" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#5b6a78"/><stop offset="1" stopColor="#1a2632"/></linearGradient>
      <linearGradient id="batterySteel" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c2cbd2"/><stop offset="1" stopColor="#586878"/></linearGradient>
    </defs>
    <path className="floor-grid" d="M30 320H730M75 350H685M140 295l-65 55M280 295l-65 55M420 295l-65 55M560 295l-65 55M700 295l-65 55"/>
    <g className={exploded ? 'chassis exploded-chassis' : 'chassis'}>
      <path d="M150 166 385 75 628 160 390 259z" fill="url(#bodyTop)" stroke="#c2cbd3" strokeWidth="3"/>
      <path d="M150 166 390 259v73L150 236z" fill="url(#bodySide)" stroke="#8a9aa8" strokeWidth="3"/>
      <path d="M390 259 628 160v74l-238 98z" fill="#263441" stroke="#8192a2" strokeWidth="3"/>
      <path d="M176 172 385 92 595 164 389 247z" fill="#1d2935" stroke={accent} strokeWidth="4"/>
      <path d="M198 174 385 104 566 166 389 232z" fill="#354554"/>
      <path d="M220 174 386 111 540 165 388 222z" fill="#1a2632" stroke="#718394" strokeWidth="2"/>
    </g>
    <g className={exploded ? 'battery-module battery-raised' : 'battery-module'}>
      <path d="M286 144 388 103 488 139 386 181z" fill="url(#batterySteel)" stroke="#e0e6ea" strokeWidth="3"/>
      <path d="M286 144 386 181v47l-100-40z" fill="#4b5e6e" stroke="#c2ccd5" strokeWidth="2"/>
      <path d="M386 181 488 139v47l-102 42z" fill="#293947" stroke="#a1aeb9" strokeWidth="2"/>
      {Array.from({length:6}).map((_,i)=><g key={i}><path d={'M'+(305+i*14)+' '+(142-i*5.5)+' l0 39'} stroke={accent} strokeWidth="7" opacity=".95"/><path d={'M'+(310+i*14)+' '+(139-i*5.5)+' l0 40'} stroke="#e0e6eb" strokeWidth="2" opacity=".65"/></g>)}
      <rect x="358" y="113" width="52" height="10" rx="3" fill="#141e28" transform="rotate(-21 358 113)"/>
    </g>
    <g>
      <path d="M170 214 226 235v43l-56-22z" fill="#111b24" stroke="#a4b2bf" strokeWidth="3"/><circle cx="199" cy="255" r="31" fill="#0b131b" stroke="#718394" strokeWidth="8"/><circle cx="199" cy="255" r="12" fill="#a1afba" stroke="#293743" strokeWidth="4"/>
      <path d="M550 165 609 146v43l-59 24z" fill="#111b24" stroke="#a4b2bf" strokeWidth="3"/><circle cx="580" cy="187" r="31" fill="#0b131b" stroke="#718394" strokeWidth="8"/><circle cx="580" cy="187" r="12" fill="#a1afba" stroke="#293743" strokeWidth="4"/>
      <path d="M342 281 398 304v43l-56-22z" fill="#111b24" stroke="#a4b2bf" strokeWidth="3"/><circle cx="371" cy="324" r="27" fill="#0b131b" stroke="#718394" strokeWidth="7"/><circle cx="371" cy="324" r="10" fill="#a1afba"/>
      <path d="M462 234 520 211v43l-58 23z" fill="#111b24" stroke="#a4b2bf" strokeWidth="3"/><circle cx="491" cy="254" r="27" fill="#0b131b" stroke="#718394" strokeWidth="7"/><circle cx="491" cy="254" r="10" fill="#a1afba"/>
    </g>
    <g className={wheelClass}><circle cx="199" cy="255" r="8" fill={accent}/><circle cx="580" cy="187" r="8" fill={accent}/><circle cx="371" cy="324" r="7" fill={accent}/><circle cx="491" cy="254" r="7" fill={accent}/></g>
    <g><rect x="215" y="151" width="50" height="20" rx="5" fill="#dca052" stroke="#f9d59e" strokeWidth="2"/><rect x="514" y="128" width="48" height="20" rx="5" fill="#dca052" stroke="#f9d59e" strokeWidth="2"/><circle cx="244" cy="158" r="6" fill="#76d4ff"/><circle cx="541" cy="135" r="6" fill="#76d4ff"/></g>
    <path d="M151 166 385 75 628 160" fill="none" stroke={accent} strokeWidth="5"/>
    {exploded && <g className="callout"><path d="M386 110V35h120"/><text x="515" y="40">BATTERY MODULE</text><path d="M199 255 116 286H60"/><text x="60" y="278">DRIVE WHEEL</text><path d="M541 135V72h110"/><text x="656" y="76">SAFETY SENSOR</text></g>}
    <text x="32" y="370" className="svg-caption">{shuttle.manufacturer.toUpperCase()} · ISOMETRIC ASSEMBLY</text>
  </svg>;
}

function BatteryPack({ battery }: { battery?: Battery }) {
  const soc = battery?.soc;
  return <div className="battery-render">
    <div className="battery-cap"><span/><span/></div>
    <div className="battery-case">
      <div className="battery-handle"/>
      <div className="battery-cells">{Array.from({length:12}).map((_,i)=><div key={i} className="battery-cell" style={{opacity: soc == null ? .27 : i < Math.round(soc / 100 * 12) ? 1 : .2}}/>)}</div>
      <div className="battery-leds"><i/><i/><i/></div>
    </div>
    <div className="battery-render-label">{battery?.model || 'BATTERY MODULE'} · {soc == null ? 'SOC NOT VERIFIED' : soc + '% REPORTED'}</div>
  </div>;
}

function App() {
  const [language, setLanguage] = useState<Language>(() => readLocal('language', 'en'));
  const [theme, setTheme] = useState<Theme>(() => readLocal('theme', 'dark'));
  const [activeTab, setActiveTab] = useState<Tab>(() => tabFromLocation());
  const [currentUser, setCurrentUser] = useState(users[0]);
  const [shuttles, setShuttles] = useState<Shuttle[]>(() => readLocal('shuttles', initialShuttles));
  const [batteries, setBatteries] = useState<Battery[]>(() => readLocal('batteries', initialBatteries));
  const [faults, setFaults] = useState<Fault[]>(() => readLocal('faults', initialFaults));
  const [jobs, setJobs] = useState<MaintenanceJob[]>(() => readLocal('maintenance', initialMaintenance));
  const [notifications, setNotifications] = useState(() => readLocal('notifications', initialNotifications));
  const [settings, setSettings] = useState<AppSettings>(() => readLocal('settings', defaultSettings));
  const [selectedId, setSelectedId] = useState('SC-01');
  const [selectedBatteryId, setSelectedBatteryId] = useState('BAT-ACME-01');
  const [modelView, setModelView] = useState<ModelView>('iso');
  const [modelZoom, setModelZoom] = useState(1);
  const [viewResetKey, setViewResetKey] = useState(0);
  const [selectedPart, setSelectedPart] = useState<EngineeringPart>('chassis');
  const [exploded, setExploded] = useState(false);
  const [animated, setAnimated] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [newAsset, setNewAsset] = useState({ manufacturer: 'Cassioli', zone: '', model: '', serialNumber: '', hardwareVersion: '', firmwareVersion: '', assignedOperator: '', notes: '' });
  const [editingShuttle, setEditingShuttle] = useState<Shuttle | null>(null);
  const [editingBattery, setEditingBattery] = useState(false);
  const [pendingShuttleArchive, setPendingShuttleArchive] = useState<string | null>(null);
  const [pendingBatteryArchive, setPendingBatteryArchive] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [dailyReports, setDailyReports] = useState<DailyReportSnapshot[]>(() => readLocal('dailyReports', []));
  const routeStackRef = useRef<Tab[]>([tabFromLocation()]);

  const t = copy[language];
  const activeShuttles = shuttles.filter(s => !s.archivedAt);
  const archivedShuttles = shuttles.filter(s => Boolean(s.archivedAt));
  const activeBatteries = batteries.filter(b => !b.archivedAt);
  const archivedBatteries = batteries.filter(b => Boolean(b.archivedAt));
  const selected = activeShuttles.find(s => s.id === selectedId) || activeShuttles[0] || null;
  const selectedBattery = activeBatteries.find(b => b.id === selectedBatteryId) || activeBatteries[0] || null;
  const selectedManufacturerReference = selected ? getManufacturerReference(selected.manufacturer) : null;
  const filteredShuttles = useMemo(() => activeShuttles.filter(s => {
    const q = search.toLowerCase();
    const matchText = [s.id, s.manufacturer, s.warehouseZone].some(v => v.toLowerCase().includes(q));
    return matchText && (statusFilter === 'ALL' || s.status === statusFilter);
  }), [activeShuttles, search, statusFilter]);

  useEffect(() => {
    const values: Record<string, unknown> = { language, theme, shuttles, batteries, faults, maintenance: jobs, notifications, settings, dailyReports };
    try { Object.entries(values).forEach(([key, value]) => localStorage.setItem(PREFIX + key, JSON.stringify(value))); } catch { /* local storage is optional */ }
  }, [language, theme, shuttles, batteries, faults, jobs, notifications, settings, dailyReports]);

  const metrics = {
    total: activeShuttles.length,
    running: activeShuttles.filter(s => s.status === 'Running').length,
    idle: activeShuttles.filter(s => s.status === 'Idle' || s.status === 'Ready').length,
    faulted: faults.filter(f => f.status !== 'Resolved').length,
    disconnected: activeShuttles.filter(s => s.connectivity !== 'REAL').length,
    verifiedSoc: activeBatteries.filter(b => b.connectionMode === 'REAL' && b.soc !== null).length
  };

  useEffect(() => {
    const syncFromAddress = () => {
      const next = tabFromLocation();
      const stack = routeStackRef.current;
      if (stack[stack.length - 1] !== next) {
        const previousIndex = stack.lastIndexOf(next);
        routeStackRef.current = previousIndex >= 0 ? stack.slice(0, previousIndex + 1) : [...stack, next];
      }
      setActiveTab(next);
    };
    if (!window.location.hash) window.history.replaceState({ tab: 'dashboard' }, '', '#/dashboard');
    window.addEventListener('popstate', syncFromAddress);
    window.addEventListener('hashchange', syncFromAddress);
    return () => {
      window.removeEventListener('popstate', syncFromAddress);
      window.removeEventListener('hashchange', syncFromAddress);
    };
  }, []);

  useEffect(() => {
    const page = navItems.find((item) => item.id === activeTab);
    document.title = page ? `${page.en} · ShuttleOps` : 'ShuttleOps';
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeTab]);

  const go = (tab: Tab) => {
    if (tab !== activeTab) {
      window.history.pushState({ tab }, '', `#/${tab}`);
      routeStackRef.current = [...routeStackRef.current, tab];
    }
    setActiveTab(tab);
    setMobileNav(false);
  };
  const goBack = () => {
    if (routeStackRef.current.length > 1) {
      const next = routeStackRef.current[routeStackRef.current.length - 2];
      routeStackRef.current = routeStackRef.current.slice(0, -1);
      window.history.back();
      setActiveTab(next);
      setMobileNav(false);
      return;
    }
    if (activeTab !== 'dashboard') go('dashboard');
  };
  const canGoBack = routeStackRef.current.length > 1 || activeTab !== 'dashboard';
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  const pushNotification = (title: string, detail: string, severity: NotificationItem['severity'] = 'info') => {
    if (!settings.notificationsEnabled) return;
    const item: NotificationItem = {
      id: 'NTF-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
      title,
      detail,
      severity,
      time: new Date().toISOString()
    };
    setNotifications(prev => [item, ...prev].slice(0, 100));
  };
  const dismissNotification = (id: string) => setNotifications(prev => prev.filter(item => item.id !== id));
  const clearNotifications = () => setNotifications([]);
  const formatNotificationTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t.noData;
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };
  const updateShuttle = (id: string, patch: Partial<Shuttle>) => {
    const current = shuttles.find(item => item.id === id);
    setShuttles(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
    if (current && patch.connectivity && patch.connectivity !== current.connectivity && settings.communicationAlerts) {
      pushNotification(
        language === 'ar' ? 'تغيير حالة اتصال العربة' : 'Shuttle connection state changed',
        `${id}: ${current.connectivity} → ${patch.connectivity}. ${language === 'ar' ? 'تم تسجيل التغيير محليًا فقط.' : 'Recorded locally only; no live device command was sent.'}`,
        patch.connectivity === 'REAL' ? 'info' : 'warning'
      );
    }
  };
  const updateBattery = (id: string, patch: Partial<Battery>) => {
    const current = batteries.find(item => item.id === id);
    setBatteries(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
    if (current && patch.status && patch.status !== current.status && settings.batteryAlerts) {
      pushNotification(
        language === 'ar' ? 'تغيير حالة البطارية' : 'Battery status changed',
        `${id}: ${current.status} → ${patch.status}. ${language === 'ar' ? 'حالة يدوية محلية وليست قراءة مباشرة.' : 'Manual local status only; not live battery telemetry.'}`,
        patch.status === 'Fault' ? 'error' : 'warning'
      );
    }
  };
  const changeFaultStatus = (id: string, status: Fault['status']) => {
    const current = faults.find(item => item.id === id);
    setFaults(prev => prev.map(item => item.id === id ? { ...item, status } : item));
    if (current && current.status !== status) {
      pushNotification(
        language === 'ar' ? 'تحديث سجل عطل' : 'Fault record updated',
        `${current.id} · ${current.shuttleId}: ${current.status} → ${status}`,
        status === 'Resolved' ? 'info' : 'warning'
      );
    }
  };
  const changeJobStatus = (id: string, status: MaintenanceJob['status']) => {
    const current = jobs.find(item => item.id === id);
    setJobs(prev => prev.map(item => item.id === id ? { ...item, status } : item));
    if (current && current.status !== status && settings.maintenanceReminders) {
      pushNotification(
        language === 'ar' ? 'تحديث أمر صيانة' : 'Maintenance work order updated',
        `${current.id} · ${current.shuttleId}: ${current.status} → ${status}`,
        status === 'Completed' ? 'info' : 'warning'
      );
    }
  };

  const addShuttle = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = 'SC-' + String(Math.max(0, ...shuttles.map(s => Number(s.id.replace('SC-', '')) || 0)) + 1).padStart(2, '0');
    const record: Shuttle = {
      id, manufacturer: newAsset.manufacturer.trim() || 'Other', model: newAsset.model.trim() || 'Not recorded',
      serialNumber: newAsset.serialNumber.trim() || 'Not recorded', hardwareVersion: newAsset.hardwareVersion.trim() || 'Not recorded', firmwareVersion: newAsset.firmwareVersion.trim() || 'Not recorded',
      warehouseZone: newAsset.zone.trim() || 'Not recorded', status: 'Unknown', connectivity: 'UNKNOWN',
      installedBattery: 'Not recorded', operatingHours: null, operatingCycles: null, faultHistory: [],
      maintenanceHistory: [], assignedOperator: newAsset.assignedOperator.trim() || 'Not assigned', lastCommunication: 'Not connected',
      notes: newAsset.notes.trim() || 'New local asset record. Equipment identity and telemetry are not verified.'
    };
    setShuttles(prev => [...prev, record]); setSelectedId(id);
    setNewAsset({ manufacturer: 'Cassioli', zone: '', model: '', serialNumber: '', hardwareVersion: '', firmwareVersion: '', assignedOperator: '', notes: '' });
    pushNotification(language === 'ar' ? 'تم تسجيل جهاز جديد' : 'New shuttle registered', `${id} · ${record.manufacturer}`);
    showToast(t.done);
  };

  const archiveShuttle = (id: string) => {
    const archivedAt = new Date().toISOString();
    setShuttles(prev => prev.map(item => item.id === id ? { ...item, archivedAt } : item));
    const next = activeShuttles.find(item => item.id !== id);
    if (selectedId === id) setSelectedId(next?.id || '');
    setPendingShuttleArchive(null);
    pushNotification(language === 'ar' ? 'تم أرشفة جهاز' : 'Shuttle archived', `${id} · ${language === 'ar' ? 'تم الاحتفاظ بسجل الأعطال والصيانة' : 'History retained in the local archive'}`, 'warning');
    showToast(language === 'ar' ? 'تمت الأرشفة مع الاحتفاظ بالسجل' : 'Archived; history retained');
  };

  const restoreShuttle = (id: string) => {
    setShuttles(prev => prev.map(item => item.id === id ? { ...item, archivedAt: null } : item));
    setSelectedId(id);
    pushNotification(language === 'ar' ? 'تم استعادة جهاز' : 'Shuttle restored', id);
  };

  const saveShuttleEdit = (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const patch: Partial<Shuttle> = {
      manufacturer: String(form.get('manufacturer') || 'Other').trim(),
      model: String(form.get('model') || 'Not recorded').trim() || 'Not recorded',
      serialNumber: String(form.get('serialNumber') || 'Not recorded').trim() || 'Not recorded',
      hardwareVersion: String(form.get('hardwareVersion') || 'Not recorded').trim() || 'Not recorded',
      firmwareVersion: String(form.get('firmwareVersion') || 'Not recorded').trim() || 'Not recorded',
      warehouseZone: String(form.get('zone') || 'Not recorded').trim() || 'Not recorded',
      assignedOperator: String(form.get('operator') || 'Not assigned').trim() || 'Not assigned',
      notes: String(form.get('notes') || '').trim(),
      status: String(form.get('status') || 'Unknown') as ShuttleStatus
    };
    updateShuttle(id, patch);
    setEditingShuttle(null);
    showToast(language === 'ar' ? 'تم حفظ تعديلات الجهاز' : 'Equipment details saved');
  };

  const addBattery = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const seq = Math.max(0, ...batteries.map(b => Number(b.id.match(/^BAT-(\d+)$/)?.[1]) || 0)) + 1;
    const id = 'BAT-' + String(seq).padStart(3, '0');
    const assignment = String(form.get('assignment') || '').trim() || 'Unassigned';
    const record: Battery = {
      id,
      manufacturer: String(form.get('manufacturer') || 'Not recorded').trim(),
      model: String(form.get('model') || 'Not recorded').trim() || 'Not recorded',
      chemistry: String(form.get('chemistry') || 'Not verified').trim() || 'Not verified',
      nominalVoltage: String(form.get('voltage') || 'Not recorded').trim() || 'Not recorded',
      capacity: String(form.get('capacity') || 'Not recorded').trim() || 'Not recorded',
      soc: null, soh: null, temperature: null, voltage: null, current: null, cycles: null,
      installationDate: 'Not recorded', lastMaintenance: 'Not recorded', assignment, 
      notes: String(form.get('notes') || '').trim() || 'New local battery register entry. Technical specifications and telemetry are not verified.',
      status: assignment === 'Unassigned' ? 'Spare' : 'Installed',
      connectionMode: 'UNKNOWN'
    };
    const previouslyInstalled = assignment !== 'Unassigned'
      ? shuttles.find(item => item.id === assignment)?.installedBattery
      : undefined;
    setBatteries(prev => [
      ...prev.map(item => previouslyInstalled && item.id === previouslyInstalled
        ? { ...item, assignment: 'Unassigned', status: 'Available' as const }
        : item),
      record
    ]);
    setSelectedBatteryId(id);
    if (assignment !== 'Unassigned') {
      setShuttles(prev => prev.map(shuttle => shuttle.id === assignment ? { ...shuttle, installedBattery: id } : shuttle));
    }
    event.currentTarget.reset();
    pushNotification(language === 'ar' ? 'تم تسجيل بطارية جديدة' : 'New battery registered', `${id} · ${assignment}`);
    showToast(language === 'ar' ? 'تم تسجيل البطارية' : 'Battery registered');
  };

  const saveBatteryDetails = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBattery) return;
    const form = new FormData(event.currentTarget);
    const numberOrNull = (key: string) => {
      const raw = String(form.get(key) ?? '').trim();
      if (!raw) return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    updateBattery(selectedBattery.id, {
      manufacturer: String(form.get('manufacturer') || 'Not recorded').trim(),
      model: String(form.get('model') || 'Not recorded').trim() || 'Not recorded',
      chemistry: String(form.get('chemistry') || 'Not verified').trim() || 'Not verified',
      nominalVoltage: String(form.get('nominalVoltage') || 'Not recorded').trim() || 'Not recorded',
      capacity: String(form.get('capacity') || 'Not recorded').trim() || 'Not recorded',
      soc: numberOrNull('soc'),
      soh: numberOrNull('soh'),
      temperature: numberOrNull('temperature'),
      voltage: numberOrNull('voltage'),
      current: numberOrNull('current'),
      cycles: numberOrNull('cycles'),
      notes: String(form.get('notes') || '').trim()
    });
    setEditingBattery(false);
    showToast(language === 'ar' ? 'تم حفظ بيانات البطارية' : 'Battery details saved');
  };

  const archiveBattery = (id: string) => {
    setBatteries(prev => prev.map(item => item.id === id ? { ...item, archivedAt: new Date().toISOString() } : item));
    setShuttles(prev => prev.map(item => item.installedBattery === id ? { ...item, installedBattery: 'Not recorded' } : item));
    setSelectedBatteryId(activeBatteries.find(item => item.id !== id)?.id || '');
    setPendingBatteryArchive(null);
    pushNotification(language === 'ar' ? 'تمت أرشفة بطارية' : 'Battery archived', id, 'warning');
    showToast(language === 'ar' ? 'تمت أرشفة البطارية' : 'Battery archived');
  };

  const restoreBattery = (id: string) => {
    setBatteries(prev => prev.map(item => item.id === id ? { ...item, archivedAt: null } : item));
    setSelectedBatteryId(id);
    pushNotification(language === 'ar' ? 'تمت استعادة بطارية' : 'Battery restored', id);
  };

  const generateDailyReport = () => {
    const now = new Date();
    const reportDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const report: DailyReportSnapshot = {
      id: 'RPT-' + now.getTime(),
      reportDate,
      generatedAt: now.toISOString(),
      shuttleCount: activeShuttles.length,
      runningCount: activeShuttles.filter(item => item.status === 'Running').length,
      readyCount: activeShuttles.filter(item => item.status === 'Ready').length,
      disconnectedCount: activeShuttles.filter(item => item.connectivity !== 'REAL').length,
      openFaultCount: faults.filter(item => item.status !== 'Resolved').length,
      openMaintenanceCount: jobs.filter(item => item.status !== 'Completed').length,
      batteryCount: activeBatteries.length,
      faultedBatteryCount: activeBatteries.filter(item => item.status === 'Fault').length,
      verifiedTelemetryCount: activeShuttles.filter(item => item.connectivity === 'REAL').length + activeBatteries.filter(item => item.connectionMode === 'REAL').length,
      shuttles: activeShuttles.map(item => ({ id: item.id, manufacturer: item.manufacturer, status: item.status, connectivity: item.connectivity, warehouseZone: item.warehouseZone })),
      batteries: activeBatteries.map(item => ({ id: item.id, manufacturer: item.manufacturer, status: item.status, assignment: item.assignment, soc: item.soc, connectionMode: item.connectionMode }))
    };
    setDailyReports(prev => [report, ...prev].slice(0, 90));
    pushNotification(language === 'ar' ? 'تم إصدار التقرير اليومي' : 'Daily report generated', `${report.id} · ${report.reportDate}`);
    showToast(language === 'ar' ? 'تم حفظ التقرير اليومي' : 'Daily report saved locally');
  };

  const downloadDailyReport = (report: DailyReportSnapshot) => {
    const rows: Array<Array<string | number>> = [
      ['SHUTTLE OPERATIONS · DAILY DEVICE STATUS', report.reportDate],
      ['Generated at', report.generatedAt],
      ['Active shuttle units', report.shuttleCount],
      ['Running', report.runningCount],
      ['Ready', report.readyCount],
      ['Not connected / unverified', report.disconnectedCount],
      ['Open fault reports', report.openFaultCount],
      ['Open maintenance orders', report.openMaintenanceCount],
      ['Active batteries', report.batteryCount],
      ['Faulted batteries', report.faultedBatteryCount],
      ['Verified telemetry sources', report.verifiedTelemetryCount],
      [],
      ['SHUTTLES', 'Manufacturer', 'Status', 'Connectivity', 'Zone'],
      ...report.shuttles.map(item => [item.id, item.manufacturer, item.status, item.connectivity, item.warehouseZone]),
      [],
      ['BATTERIES', 'Manufacturer', 'Status', 'Assignment', 'SOC', 'Connection'],
      ...report.batteries.map(item => [item.id, item.manufacturer, item.status, item.assignment, item.soc === null ? 'Not verified' : item.soc + '%', item.connectionMode])
    ];
    const csv = rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g,'""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `shuttle-daily-report-${report.reportDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const assignSelectedBattery = (shuttleId: string) => {
    if (!selectedBattery) return;
    const previousAssignment = selectedBattery.assignment;
    const targetBatteryId = shuttles.find(item => item.id === shuttleId)?.installedBattery;
    setBatteries(prev => prev.map(item => {
      if (item.id === selectedBattery.id) return { ...item, assignment: shuttleId || 'Unassigned', status: shuttleId ? 'Installed' : 'Spare' };
      if (targetBatteryId && item.id === targetBatteryId && item.assignment === shuttleId) return { ...item, assignment: 'Unassigned', status: 'Available' };
      return item;
    }));
    setShuttles(prev => prev.map(item => {
      if (item.id === shuttleId) return { ...item, installedBattery: selectedBattery.id };
      if (item.id === previousAssignment && item.installedBattery === selectedBattery.id) return { ...item, installedBattery: 'Not recorded' };
      return item;
    }));
    pushNotification(language === 'ar' ? 'تم تحديث تخصيص البطارية' : 'Battery assignment updated', `${selectedBattery.id} → ${shuttleId || 'Unassigned'}`);
  };

  const addFault = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const record: Fault = {
      id: 'FLT-' + Date.now(), shuttleId: String(form.get('shuttleId') || selected?.id || 'Unassigned'),
      title: String(form.get('title') || 'Reported fault'), severity: String(form.get('severity') || 'Moderate') as Fault['severity'],
      status: 'Open', timestamp: new Date().toISOString(), description: String(form.get('description') || ''),
      probableCauses: [String(form.get('cause') || 'Not established')], diagnosticProcedure: String(form.get('procedure') || 'Field verification required'),
      correctiveAction: '', assignedTechnician: String(form.get('technician') || 'Not assigned')
    };
    setFaults(prev => [record, ...prev]);
    pushNotification(
      language === 'ar' ? 'تم تسجيل بلاغ عطل' : 'New fault report recorded',
      `${record.id} · ${record.shuttleId} · ${record.title} · ${record.severity}`,
      record.severity === 'Critical' || record.severity === 'Major' ? 'error' : 'warning'
    );
    event.currentTarget.reset(); showToast(t.done);
  };

  const addJob = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const job: MaintenanceJob = {
      id: 'MNT-' + Date.now(), shuttleId: String(form.get('shuttleId') || selected?.id || 'Unassigned'),
      title: String(form.get('title') || 'Inspection'), type: String(form.get('type') || 'Preventive') as MaintenanceJob['type'],
      status: 'Scheduled', scheduledDate: String(form.get('date') || ''), technician: String(form.get('technician') || 'Not assigned'),
      notes: String(form.get('notes') || '')
    };
    setJobs(prev => [job, ...prev]);
    if (settings.maintenanceReminders) {
      pushNotification(
        language === 'ar' ? 'تم إنشاء أمر صيانة' : 'Maintenance work order created',
        `${job.id} · ${job.shuttleId} · ${job.title} · ${job.scheduledDate}`,
        'info'
      );
    }
    event.currentTarget.reset(); showToast(t.done);
  };

  const recordCorrectiveAction = (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const action = String(form.get('action') || '').trim(); if (!action) return;
    setFaults(prev => prev.map(f => f.id === id ? { ...f, correctiveAction: action } : f));
    pushNotification(
      language === 'ar' ? 'تم توثيق إجراء تصحيحي' : 'Corrective action documented',
      `${id} · ${language === 'ar' ? 'تم حفظ الإجراء محليًا' : 'Action saved locally'}`,
      'info'
    );
    event.currentTarget.reset(); showToast(t.done);
  };

  const statusText = (status: ShuttleStatus) => {
    const key: Record<ShuttleStatus, string> = { Ready: 'statusReady', Running: 'statusRunning', Idle: 'statusIdle', Charging: 'statusCharging', Maintenance: 'statusMaintenance', Fault: 'statusFault', Disconnected: 'statusDisconnected', Unknown: 'statusUnknown' };
    return t[key[status] as keyof typeof copy.en];
  };

  const exportCsv = () => {
    const rows = [['Type','ID','Manufacturer','State','Connectivity','Notes'],
      ...shuttles.map(s => ['Shuttle',s.id,s.manufacturer,s.status,s.connectivity,s.notes]),
      ...batteries.map(b => ['Battery',b.id,b.manufacturer,b.status,b.connectionMode,b.notes]),
      ...faults.map(f => ['Fault',f.id,f.shuttleId,f.status,f.severity,f.description]),
      ...jobs.map(j => ['Maintenance',j.id,j.shuttleId,j.status,j.type,j.notes])];
    const csv = rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g,'""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'shuttle-register.csv'; link.click(); URL.revokeObjectURL(url);
  };
  const exportBackup = () => {
    const data = { schemaVersion: 9, exportedAt: new Date().toISOString(), warning: 'Local demo/record data only. Not a live PLC telemetry export.', shuttles, batteries, faults, jobs, notifications, settings, dailyReports };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'shuttle-local-backup.json'; link.click(); URL.revokeObjectURL(url);
  };

  const importBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Record<string, unknown>;
        if (!Array.isArray(data.shuttles) || !Array.isArray(data.batteries) || !Array.isArray(data.faults) || !Array.isArray(data.jobs)) {
          throw new Error('Backup structure is incomplete');
        }
        setShuttles(data.shuttles as Shuttle[]);
        setBatteries(data.batteries as Battery[]);
        setFaults(data.faults as Fault[]);
        setJobs(data.jobs as MaintenanceJob[]);
        setNotifications(Array.isArray(data.notifications) ? data.notifications as NotificationItem[] : []);
        setDailyReports(Array.isArray(data.dailyReports) ? data.dailyReports as DailyReportSnapshot[] : []);
        if (data.settings && typeof data.settings === 'object') setSettings(data.settings as AppSettings);
        setSelectedId((data.shuttles as Shuttle[]).find(item => !item.archivedAt)?.id || '');
        setSelectedBatteryId((data.batteries as Battery[]).find(item => !item.archivedAt)?.id || '');
        showToast(language === 'ar' ? 'تم استيراد النسخة الاحتياطية' : 'Backup restored');
      } catch {
        showToast(language === 'ar' ? 'ملف النسخة الاحتياطية غير صالح' : 'Backup file is invalid');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const resetLocalData = () => {
    if (!window.confirm(language === 'ar' ? 'سيتم حذف السجلات المحلية وإعادة بيانات البداية. هل تريد المتابعة؟' : 'Delete local records and restore seed data?')) return;
    setShuttles(initialShuttles);
    setBatteries(initialBatteries);
    setFaults(initialFaults);
    setJobs(initialMaintenance);
    setNotifications(initialNotifications);
    setDailyReports([]);
    setSelectedId('SC-01');
    setSelectedBatteryId('BAT-ACME-01');
    showToast(language === 'ar' ? 'تمت إعادة بيانات البداية' : 'Seed data restored');
  };

  const header = navItems.find(n => n.id === activeTab);
  const statusOptions: ShuttleStatus[] = ['Ready','Running','Idle','Charging','Maintenance','Fault','Disconnected','Unknown'];

  return <div className={'app-shell ' + theme} dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <aside className={'sidebar ' + (mobileNav ? 'mobile-open' : '')}>
      <div className="brand-block">
        <div className="brand-symbol"><span/><span/><span/></div>
        <div className="brand-copy"><strong>SHUTTLE<span>OPS</span></strong><small>ENGINEERING PLATFORM</small></div>
        <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation">×</button>
      </div>
      <div className="sidebar-caption">{t.appName}</div>
      {['OPERATIONS','ENGINEERING','SYSTEM','ADMIN'].map(group => <div className="nav-group" key={group}>
        <div className="nav-group-title">{language === 'ar' ? ({OPERATIONS:'التشغيل',ENGINEERING:'الهندسة',SYSTEM:'النظام',ADMIN:'الإدارة'} as Record<string,string>)[group] : group}</div>
        {navItems.filter(item => item.group === group).map(item => <button key={item.id} type="button" title={language === 'ar' ? item.ar : item.en} aria-current={activeTab === item.id ? 'page' : undefined} className={'nav-button ' + (activeTab === item.id ? 'active' : '')} onClick={() => go(item.id)}>
          <Icon name={item.icon}/><span>{language === 'ar' ? item.ar : item.en}</span>{activeTab === item.id && <i className="nav-active-mark"/>}
        </button>)}
      </div>)}
      <div className="sidebar-footer"><div className="connection-indicator"><i/> {language === 'ar' ? 'وضع محلي — غير متصل' : 'LOCAL MODE · OFFLINE'}</div><div className="sidebar-user"><div className="avatar">SA</div><div><strong>{currentUser.name}</strong><small>{currentUser.role}</small></div></div></div>
    </aside>

    <main className="workspace">
      <header className="topbar">
        <div className="topbar-heading"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Icon name="grid" size={20}/></button><div className="breadcrumb">SHUTTLE OPS <span>/</span> {language === 'ar' ? header?.ar : header?.en}</div><h1>{language === 'ar' ? header?.ar : header?.en}</h1></div>
        <div className="topbar-actions">
          <button className="topbar-route-button" type="button" onClick={goBack} disabled={!canGoBack} aria-label={language === 'ar' ? 'رجوع' : 'Go back'} title={language === 'ar' ? 'رجوع' : 'Go back'}><Icon name="chevron" size={17}/></button>
          <button className="topbar-route-button" type="button" onClick={() => go('dashboard')} aria-label={language === 'ar' ? 'الرئيسية' : 'Home'} title={language === 'ar' ? 'الرئيسية' : 'Home'}><Icon name="grid" size={17}/></button>
          <button className="topbar-route-button" type="button" onClick={() => go('settings')} aria-label={language === 'ar' ? 'الإعدادات' : 'Settings'} title={language === 'ar' ? 'الإعدادات' : 'Settings'}><Icon name="settings" size={17}/></button>
          <div className="system-chip"><i/> {language === 'ar' ? 'لا يوجد اتصال حي' : 'NO LIVE CONNECTION'}</div>
          <button className="language-toggle" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>{language === 'en' ? 'Arabic' : 'English'}</button>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name="settings" size={16}/><span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span></button>
        </div>
      </header>

      <nav className="mobile-nav" aria-label={language === 'ar' ? 'التنقل السريع' : 'Quick navigation'}>
        {navItems.slice(0, 4).map((item) => <button key={item.id} type="button" className={activeTab === item.id ? 'active' : ''} aria-current={activeTab === item.id ? 'page' : undefined} onClick={() => go(item.id)}><Icon name={item.icon} size={16}/><span>{language === 'ar' ? item.ar : item.en}</span></button>)}
        <button type="button" onClick={() => setMobileNav(true)} aria-expanded={mobileNav}><Icon name="grid" size={16}/><span>{language === 'ar' ? 'المزيد' : 'More'}</span></button>
      </nav>

      <div className="demo-banner" role="status"><div className="demo-icon"><Icon name="alert" size={18}/></div><div><strong>{t.demo}</strong><p>{t.demoText}</p></div><span className="demo-tag">{t.unverified}</span></div>

      {activeTab === 'dashboard' && <section className="page-content">
        <div className="hero-panel">
          <div className="hero-copy"><div className="eyebrow"><span/> PRECISION INDUSTRIAL · MECHANICAL INTELLIGENCE</div><h2>{language === 'ar' ? 'تحكم هندسي في أسطول الشاتل' : 'Precision control for your shuttle fleet'}</h2><p>{language === 'ar' ? 'مركز موحد لمتابعة العربات والبطاريات والأعطال والصيانة، مع رسومات ميكانيكية تفاعلية.' : 'A unified workspace for shuttle assets, battery records, faults and maintenance — with interactive mechanical visualization.'}</p><div className="hero-actions"><button className="btn-primary" onClick={() => go('fleet')}>{t.openFleet}<Icon name="arrow" size={16}/></button><button className="btn-secondary" onClick={() => go('engineering')}>{t.openEngineering}</button></div><div className="hero-footnote"><span className="pulse-dot"/> {language === 'ar' ? 'عدد الأجهزة النشطة: ' + metrics.total : metrics.total + ' active units in the local fleet register'}</div></div>
          <div className="hero-machine"><div className="machine-orbit orbit-one"/><div className="machine-orbit orbit-two"/><div className="machine-label label-top">SHUTTLE / ASRS</div><ShuttleModel shuttle={selected || initialShuttles[0]} view="iso" exploded={false} animated={animated}/><div className="machine-label label-bottom">{selected?.manufacturer || 'CASSIOLI'} · {selected?.id || 'SC-01'}</div></div>
        </div>
        <div className="section-heading"><div><span className="eyebrow">FLEET TELEMETRY / LOCAL RECORDS</span><h2>{language === 'ar' ? 'مؤشرات الأسطول' : 'Fleet at a glance'}</h2></div><button className="text-button" onClick={() => go('fleet')}>{t.viewRegister}<Icon name="chevron" size={15}/></button></div>
        <div className="metric-grid">
          <Metric icon="truck" label={t.total} value={metrics.total} accent="blue" detail={language === 'ar' ? 'إجمالي السجلات' : 'Registered assets'}/>
          <Metric icon="grid" label={t.running} value={metrics.running} accent="green" detail={language === 'ar' ? 'لا توجد قراءة تشغيل مؤكدة' : 'No verified running signal'}/>
          <Metric icon="settings" label={t.idle} value={metrics.idle} accent="amber" detail={language === 'ar' ? 'الحالة غير المسجلة مستثناة' : 'Unknown state not counted'}/>
          <Metric icon="alert" label={t.faulted} value={metrics.faulted} accent="red" detail={language === 'ar' ? 'بلاغات مسجلة يدويًا' : 'Manually reported records'}/>
          <Metric icon="network" label={t.disconnected} value={metrics.disconnected} accent="violet" detail={language === 'ar' ? 'لا يوجد مصدر بيانات حي' : 'No live data source configured'}/>
          <Metric icon="battery" label={t.battery} value={metrics.verifiedSoc === 0 ? '—' : metrics.verifiedSoc} accent="cyan" detail={language === 'ar' ? 'قراءات بحاجة إلى تحقق' : 'Verified readings only'}/>
        </div>
        <div className="dashboard-grid">
          <div className="surface-card">
            <div className="card-head"><div><span className="eyebrow">ASSET REGISTER</span><h3>{t.fleet}</h3></div><button className="icon-button" onClick={() => go('fleet')}><Icon name="arrow"/></button></div>
            <div className="mini-fleet">{activeShuttles.map(s => <button className="mini-asset" key={s.id} onClick={() => {setSelectedId(s.id);go('engineering');}}><div className={'mini-machine mini-' + s.manufacturer.toLowerCase()}><Icon name="truck" size={20}/></div><div className="mini-asset-info"><strong>{s.id}</strong><span>{s.manufacturer} · {s.model}</span></div><StatusPill status={s.status} language={language}/><Icon name="chevron" size={15}/></button>)}</div>
          </div>
          <div className="surface-card">
            <div className="card-head"><div><span className="eyebrow">SYSTEM HEALTH</span><h3>{t.systemState}</h3></div><span className="status-pill status-unknown">OFFLINE</span></div>
            <div className="system-health-graphic"><div className="hub-core"><Icon name="network" size={28}/><strong>PLC</strong><small>NOT LINKED</small></div><div className="hub-node node-one">MODBUS</div><div className="hub-node node-two">OPC UA</div><div className="hub-node node-three">MQTT</div><div className="hub-node node-four">REST</div><svg viewBox="0 0 300 180"><path d="M150 90 40 35M150 90 260 35M150 90 40 145M150 90 260 145" stroke="currentColor" strokeDasharray="5 7" opacity=".4" fill="none"/></svg></div>
            <p className="muted-text">{t.connectionSub}</p><button className="btn-secondary full" onClick={() => go('connections')}>{language === 'ar' ? 'إعداد الاتصال' : 'View connection architecture'} <Icon name="arrow" size={15}/></button>
          </div>
        </div>
      </section>}

      {activeTab === 'fleet' && <section className="page-content">
        <PageIntro eyebrow="ASSET MANAGEMENT / REGISTER" title={t.fleet} subtitle={t.fleetSub}/>
        <div className="fleet-layout">
          <div className="surface-card fleet-list-card">
            <div className="list-toolbar"><div className="search-box"><Icon name="grid"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}/></div><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="ALL">{t.allStates}</option>{statusOptions.map(s => <option key={s} value={s}>{statusText(s)}</option>)}</select></div>
            <div className="asset-list">{filteredShuttles.map(s => <button key={s.id} onClick={() => setSelectedId(s.id)} className={'asset-row ' + (selected?.id === s.id ? 'selected' : '')}><div className={'asset-icon icon-' + s.manufacturer.toLowerCase()}><Icon name="truck" size={22}/></div><div className="asset-main"><div><strong>{s.id}</strong><span className="asset-maker">{s.manufacturer}</span></div><small>{s.model} · {s.warehouseZone}</small></div><StatusPill status={s.status} language={language}/></button>)}</div>
            {filteredShuttles.length === 0 && <div className="empty-state">{t.empty}</div>}
            <button className="btn-secondary full" onClick={() => {setSearch('');setStatusFilter('ALL');}}>{t.removeFilters}</button>
          </div>
          <div className="surface-card selected-asset-card">
             {selected ? <><div className="card-head"><div><span className="eyebrow">{t.selected}</span><h3>{selected.id}</h3></div><StatusPill status={selected.status} language={language}/></div>
               <div className="selected-asset-visual"><ShuttleModel shuttle={selected} view="iso" exploded={false} animated={animated}/></div>
               {editingShuttle?.id === selected.id ? <form className="stack-form asset-edit-form" onSubmit={event => saveShuttleEdit(event, selected.id)}>
                 <label>{t.manufacturer}<select name="manufacturer" defaultValue={selected.manufacturer}><option>Cassioli</option><option>Craftsman</option><option>ACME</option><option>Other</option></select></label>
                 <label>{language==='ar'?'الموديل':'Model'}<input name="model" defaultValue={selected.model}/></label>
                 <label>{language==='ar'?'الرقم المسلسل':'Manufacturer serial'}<input name="serialNumber" defaultValue={selected.serialNumber}/></label>
                 <label>{language==='ar'?'إصدار الهاردوير':'Hardware revision'}<input name="hardwareVersion" defaultValue={selected.hardwareVersion}/></label>
                 <label>{language==='ar'?'إصدار البرنامج':'Firmware version'}<input name="firmwareVersion" defaultValue={selected.firmwareVersion}/></label>
                 <label>{t.zone}<input name="zone" defaultValue={selected.warehouseZone}/></label>
                 <label>{language==='ar'?'المشغل المسؤول':'Assigned operator'}<input name="operator" defaultValue={selected.assignedOperator}/></label>
                 <label>{t.status}<select name="status" defaultValue={selected.status}>{statusOptions.map(status=><option key={status} value={status}>{statusText(status)}</option>)}</select></label>
                 <label>{t.notes}<textarea name="notes" defaultValue={selected.notes}/></label>
                 <div className="record-actions"><button className="btn-primary" type="submit">{language==='ar'?'حفظ التعديلات':'Save changes'}</button><button className="btn-secondary" type="button" onClick={()=>setEditingShuttle(null)}>{t.cancel}</button></div>
               </form> : <>
                 <div className="asset-detail-grid"><Detail label={t.manufacturer} value={selected.manufacturer}/><Detail label={t.model} value={selected.model}/><Detail label={t.serial} value={selected.serialNumber}/><Detail label={t.zone} value={selected.warehouseZone}/><Detail label={t.batteryPack} value={selected.installedBattery}/><Detail label={t.communication} value={selected.connectivity}/><Detail label={language==='ar'?'ساعات التشغيل':'Operating hours'} value={selected.operatingHours ?? t.unknown}/><Detail label={language==='ar'?'دورات التشغيل':'Operating cycles'} value={selected.operatingCycles ?? t.unknown}/></div>
                 <div className="card-actions"><button className="btn-primary" onClick={() => go('engineering')}>{t.testView}<Icon name="arrow" size={15}/></button><button className="btn-secondary" onClick={()=>setEditingShuttle(selected)}>{language==='ar'?'تعديل بيانات الجهاز':'Edit equipment'}</button><select aria-label={language==='ar'?'حالة الجهاز':'Device status'} value={selected.status} onChange={e => updateShuttle(selected.id,{status:e.target.value as ShuttleStatus})}>{statusOptions.map(status => <option key={status} value={status}>{statusText(status)}</option>)}</select></div>
                 {pendingShuttleArchive===selected.id ? <div className="archive-confirm"><strong>{language==='ar'?'تأكيد أرشفة الجهاز؟ سيظل سجل الأعطال والصيانة محفوظًا.':'Archive this unit? Fault and maintenance history will be retained.'}</strong><button className="btn-danger" onClick={()=>archiveShuttle(selected.id)}>{language==='ar'?'تأكيد الأرشفة':'Confirm archive'}</button><button className="btn-secondary" onClick={()=>setPendingShuttleArchive(null)}>{t.cancel}</button></div> : <button className="btn-danger" type="button" onClick={()=>setPendingShuttleArchive(selected.id)}>{language==='ar'?'أرشفة الجهاز':'Archive device'}</button>}
               </>}
               <p className="muted-text">{t.localChanges}</p></>
               : <div className="empty-state">{language==='ar'?'لا توجد أجهزة نشطة. أعد جهازًا من الأرشيف أو سجل جهازًا جديدًا.':'No active units. Restore one from the archive or register a new unit.'}</div>}
           </div>
         </div>
        <div className="surface-card add-asset-card"><div className="card-head"><div><span className="eyebrow">REGISTER NEW EQUIPMENT</span><h3>{language==='ar'?'إضافة جهاز إلى الأسطول':'Register a shuttle unit'}</h3></div><Icon name="plus" size={20}/></div>
          <form className="form-grid" onSubmit={addShuttle}>
            <label>{t.manufacturer}<select value={newAsset.manufacturer} onChange={e=>setNewAsset({...newAsset,manufacturer:e.target.value})}><option>Cassioli</option><option>Craftsman</option><option>ACME</option><option>Other</option></select></label>
            <label>{language==='ar'?'الموديل':'Model'}<input value={newAsset.model} onChange={e=>setNewAsset({...newAsset,model:e.target.value})} placeholder="Not recorded"/></label>
            <label>{language==='ar'?'الرقم المسلسل':'Manufacturer serial'}<input value={newAsset.serialNumber} onChange={e=>setNewAsset({...newAsset,serialNumber:e.target.value})} placeholder="Not recorded"/></label>
            <label>{language==='ar'?'منطقة التشغيل':'Operating zone'}<input value={newAsset.zone} onChange={e=>setNewAsset({...newAsset,zone:e.target.value})} placeholder={t.noData}/></label>
            <label>{language==='ar'?'إصدار الهاردوير':'Hardware revision'}<input value={newAsset.hardwareVersion} onChange={e=>setNewAsset({...newAsset,hardwareVersion:e.target.value})} placeholder="Not recorded"/></label>
            <label>{language==='ar'?'إصدار البرنامج':'Firmware version'}<input value={newAsset.firmwareVersion} onChange={e=>setNewAsset({...newAsset,firmwareVersion:e.target.value})} placeholder="Not recorded"/></label>
            <label>{language==='ar'?'المشغل المسؤول':'Assigned operator'}<input value={newAsset.assignedOperator} onChange={e=>setNewAsset({...newAsset,assignedOperator:e.target.value})} placeholder="Not assigned"/></label>
            <label>{t.notes}<input value={newAsset.notes} onChange={e=>setNewAsset({...newAsset,notes:e.target.value})} placeholder={t.noData}/></label>
            <button className="btn-primary" type="submit">{language==='ar'?'حفظ الجهاز الجديد':'Save new device'}</button>
          </form><p className="muted-text">{t.dataNotice}</p></div>
          <div className="archive-panel"><button className="text-button" type="button" onClick={()=>setShowArchived(value=>!value)}>{showArchived?(language==='ar'?'إخفاء الأرشيف':'Hide archive'):(language==='ar'?'عرض الأجهزة المؤرشفة':'Show archived devices')} · {archivedShuttles.length}</button>
            {showArchived && archivedShuttles.map(item=><div className="archive-row" key={item.id}><div><strong>{item.id}</strong><small>{item.manufacturer} · {item.model}</small></div><button className="btn-secondary" onClick={()=>restoreShuttle(item.id)}>{language==='ar'?'استعادة':'Restore'}</button></div>)}
          </div>
          </section>}

      {activeTab === 'engineering' && selected && <section className="page-content">
        <PageIntro eyebrow="MECHANICAL INTELLIGENCE / DIGITAL SCHEMATIC" title={t.engineering} subtitle={t.engineeringSub}/>
        <div className="engineering-workspace">
          <div className="surface-card model-stage">
            <div className="model-toolbar"><div className="asset-select"><label>{t.selectAsset}</label><select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{activeShuttles.map(s=><option key={s.id} value={s.id}>{s.id} — {s.manufacturer}</option>)}</select></div><div className="model-tools"><button className={exploded?'tool-active':''} onClick={()=>setExploded(!exploded)}><Icon name="settings" size={15}/>{t.exploded}</button><button className={animated?'tool-active':''} onClick={()=>setAnimated(!animated)}><Icon name="grid" size={15}/>{animated?t.stop:t.animate}</button><button onClick={()=>{setModelView('iso');setModelZoom(1);setViewResetKey(value=>value+1);}}>{language==='ar'?'إعادة ضبط المنظور':'Reset view'}</button></div></div>
            <div className="view-tabs">{(['iso','side','front','top'] as ModelView[]).map(v=><button key={v} className={modelView===v?'active':''} onClick={()=>setModelView(v)}>{t[v]}</button>)}</div>
            <div className="model-canvas three-model-canvas">
               <div className="canvas-topline"><span>3D ENGINEERING MODEL: {selected.manufacturer.toUpperCase()} / {selected.id}</span><span>CONCEPTUAL · NOT VENDOR CAD</span></div>
               <Shuttle3DViewer manufacturer={selected.manufacturer} shuttleId={selected.id} status={selected.status} view={modelView} exploded={exploded} animated={animated} selectedPart={selectedPart} zoom={modelZoom} resetKey={viewResetKey} onSelectPart={setSelectedPart} fallback={<ShuttleModel shuttle={selected} view={modelView} exploded={exploded} animated={animated}/>}/>
               <div className="canvas-bottomline"><span><i className="legend-dot" style={{background:selected.manufacturer==='Cassioli'?'#d28b4b':selected.manufacturer==='Craftsman'?'#45b8d2':'#a58af5'}}/>{selected.manufacturer}</span><span><i className="legend-dot" style={{background:'#75d6ff'}}/>Sensors</span><span><i className="legend-dot" style={{background:'#7bd9a9'}}/>Battery module</span></div>
             </div>
             <div className="model-zoom-control"><label htmlFor="model-zoom">{language==='ar'?'تكبير الرسم':'Drawing zoom'}</label><input id="model-zoom" type="range" min="0.75" max="1.25" step="0.05" value={modelZoom} onChange={event=>setModelZoom(Number(event.target.value))}/><output>{Math.round(modelZoom*100)}%</output></div>
            <p className="disclaimer">{t.modelDisclaimer}</p>
          </div>
          <div className="engineering-side">
            <div className="surface-card"><div className="card-head"><div><span className="eyebrow">ASSET IDENTITY</span><h3>{selected.id}</h3></div><StatusPill status={selected.status} language={language}/></div><div className="spec-list"><Detail label={t.manufacturer} value={selected.manufacturer}/><Detail label={t.model} value={selected.model}/><Detail label={t.serial} value={selected.serialNumber}/><Detail label="Hardware / firmware" value={selected.hardwareVersion + ' / ' + selected.firmwareVersion}/><Detail label={t.batteryPack} value={selected.installedBattery}/><Detail label={t.lastSeen} value={selected.lastCommunication}/></div></div>
            <div className="surface-card"><div className="card-head"><div><span className="eyebrow">ASSEMBLY BREAKDOWN</span><h3>{t.componentLegend}</h3></div></div><div className="component-list">
                {([
                  {id:'chassis' as const,n:'01',title:t.chassis,desc:language==='ar'?'الهيكل الحامل وسطح تحميل الطبالي':'Structural frame and load deck'},
                  {id:'drive' as const,n:'02',title:t.drive,desc:language==='ar'?'منظومة الدفع وبيت المحرك':'Drive train and motor housing'},
                  {id:'wheels' as const,n:'03',title:t.wheel,desc:language==='ar'?'عجلات الجر والتوجيه':'Traction and guide wheel sets'},
                  {id:'battery' as const,n:'04',title:t.batteryComp,desc:language==='ar'?'حاوية الطاقة القابلة للفك':'Removable energy module'},
                  {id:'sensors' as const,n:'05',title:t.sensors,desc:language==='ar'?'نقاط الاستشعار والحماية':'Detection and protection points'}
                ]).map(part=><button type="button" key={part.id} className={'component-select-row '+(selectedPart===part.id?'selected':'')} aria-pressed={selectedPart===part.id} onClick={()=>setSelectedPart(part.id)}><ComponentRow n={part.n} title={part.title} desc={part.desc}/></button>)}
              </div>
              <div className="part-inspector">
                <span className="eyebrow">{language==='ar'?'فحص المكوّن المحدد':'SELECTED COMPONENT INSPECTOR'}</span>
                <h4>{({chassis:t.chassis,drive:t.drive,wheels:t.wheel,battery:t.batteryComp,sensors:t.sensors})[selectedPart]}</h4>
                <p>{({
                  chassis:language==='ar'?'افحص الاستقامة واللحامات ونقاط تثبيت سطح التحميل. لا توجد أبعاد مصنع موثقة داخل هذا النموذج.':'Inspect frame alignment, welds and load-deck mounting points. No vendor dimensions are verified in this model.',
                  drive:language==='ar'?'راجع تثبيت المحرك وعلبة التروس والكابلات وفق دليل الشركة المصنعة قبل أي تدخل.':'Inspect motor and gearbox mounting and cabling against the manufacturer manual before intervention.',
                  wheels:language==='ar'?'تحقق من التآكل والمحامل والالتصاق بالأرضية وخلو مسار الحركة من الثلج أو الملوثات.':'Check tread wear, bearings, floor grip and any ice or contamination on the travel path.',
                  battery:language==='ar'?'تحقق من آلية القفل والموصلات وبيانات البطارية الفعلية على شاشة المعدة.':'Verify the retention mechanism, connectors and actual battery readings on the equipment HMI.',
                  sensors:language==='ar'?'افحص نظافة العدسات والمحاذاة ومجال الكشف وسجل الإنذارات دون تجاوز دوائر الأمان.':'Inspect lens cleanliness, alignment, detection field and alarm history without bypassing safety circuits.'
                })[selectedPart]}</p>
                <small>{language==='ar'?'معلومات فحص إرشادية فقط — يلزم الرجوع إلى دليل المعدة المعتمد.':'Guidance only — consult the approved equipment service documentation.'}</small>
              </div>
            </div>
          </div>
          {selectedManufacturerReference && <div className="surface-card vendor-reference-card">
            <div className="card-head">
              <div><span className="eyebrow">{language==='ar'?'مرجع الشركة المصنعة':'MANUFACTURER SOURCE REFERENCE'}</span><h3>{selectedManufacturerReference.productFamily[language]}</h3></div>
              <span className="reference-tag">{selectedManufacturerReference.manufacturer}</span>
            </div>
            <p className="vendor-reference-scope">{selectedManufacturerReference.scopeLabel[language]}</p>
            <p className="vendor-reference-description">{selectedManufacturerReference.description[language]}</p>
            <ul className="vendor-reference-facts">{selectedManufacturerReference.facts.map((fact,index)=><li key={index}>{fact[language]}</li>)}</ul>
            <div className="cold-store-reference-note"><strong>{language==='ar'?'ملاحظة التخزين البارد':'COLD-STORE VERIFICATION'}</strong><p>{selectedManufacturerReference.coldStoreNote[language]}</p></div>
            <a className="vendor-source-link" href={selectedManufacturerReference.sourceUrl} target="_blank" rel="noreferrer">{selectedManufacturerReference.sourceLabel[language]} ↗</a>
          </div>}
        </div>
      </section>}

      {activeTab === 'batteries' && <section className="page-content">
        <PageIntro eyebrow="ENERGY SYSTEMS / BATTERY REGISTER" title={language==='ar'?'منظومة البطاريات':'Battery systems'} subtitle={language==='ar'?'إدارة سجل البطاريات وتخصيصها وحالتها وبيانات القياس المسجلة.':'Manage battery records, assignment, status and recorded readings.'}/>
        <div className="battery-layout">
          <div className="surface-card battery-stage">
            {selectedBattery ? <>
              <div className="card-head"><div><span className="eyebrow">BATTERY MODULE / {selectedBattery.id}</span><h3>{t.batteryIllustration}</h3></div><StatusPill status={selectedBattery.status} language={language}/></div>
              <Battery3DViewer battery={selectedBattery} fallback={<BatteryPack battery={selectedBattery}/>} />
              <div className="battery-stat-grid">
                <Detail label={t.charge} value={selectedBattery.soc === null ? t.unknown : selectedBattery.soc + '% (manual / reported)'}/>
                <Detail label={t.health} value={selectedBattery.soh === null ? t.noData : selectedBattery.soh + '%'}/>
                <Detail label={t.temperature} value={selectedBattery.temperature === null ? t.noData : selectedBattery.temperature + '°C'}/>
                <Detail label={t.voltage} value={selectedBattery.voltage === null ? t.noData : selectedBattery.voltage + ' V'}/>
                <Detail label={language==='ar'?'التيار':'Current'} value={selectedBattery.current === null ? t.noData : selectedBattery.current + ' A'}/>
                <Detail label={language==='ar'?'السعة':'Capacity'} value={selectedBattery.capacity}/>
                <Detail label={language==='ar'?'الجهد الاسمي':'Nominal voltage'} value={selectedBattery.nominalVoltage}/>
                <Detail label={language==='ar'?'دورات الشحن':'Charge cycles'} value={selectedBattery.cycles ?? t.noData}/>
              </div>
              <div className="notice-inline"><Icon name="alert"/>{language==='ar'?'القراءات التي تدخلها هنا يدوية/مبلغ عنها. لن تظهر كقراءات حية إلا بعد ربط مصدر موثوق والتحقق منه.':'Values entered here are manual/reported. They are not live telemetry until a verified source is connected.'}</div>
            </> : <div className="empty-state"><Icon name="battery" size={34}/><h3>{language==='ar'?'لا توجد بطاريات نشطة':'No active battery records'}</h3><p>{language==='ar'?'سجل بطارية جديدة من النموذج المجاور لبدء الإدارة.':'Register a battery using the form beside this panel.'}</p></div>}
          </div>
          <div className="surface-card battery-detail">
            <div className="card-head"><div><span className="eyebrow">BATTERY REGISTER</span><h3>{language==='ar'?'سجل البطاريات':'Battery assets'}</h3></div><span className="counter">{activeBatteries.length}</span></div>
            {activeBatteries.map(b=><button key={b.id} className={'battery-row '+(selectedBattery?.id===b.id?'selected':'')} onClick={()=>{setSelectedBatteryId(b.id);setEditingBattery(false);}}><div className="battery-row-icon"><Icon name="battery"/></div><div><strong>{b.id}</strong><small>{b.manufacturer} · {b.assignment}</small></div><StatusPill status={b.status} language={language}/></button>)}
            {selectedBattery && <>
              <div className="battery-assignment">
                <label>{language==='ar'?'تخصيص البطارية إلى جهاز':'Assign battery to shuttle'}</label>
                <select aria-label={language==='ar'?'تخصيص البطارية إلى جهاز':'Assign battery to shuttle'} value={selectedBattery.assignment === 'Unassigned' ? '' : selectedBattery.assignment} onChange={event=>assignSelectedBattery(event.target.value)}>
                  <option value="">{language==='ar'?'بدون تخصيص / احتياطي':'Unassigned / spare'}</option>
                  {activeShuttles.map(item=><option value={item.id} key={item.id}>{item.id} · {item.manufacturer}</option>)}
                </select>
              </div>
              <div className="status-actions">
                <button className="btn-secondary" onClick={()=>updateBattery(selectedBattery.id,{status:'Charging'})}>{t.setCharging}</button>
                <button className="btn-secondary" onClick={()=>updateBattery(selectedBattery.id,{status:'Available'})}>{t.setAvailable}</button>
                <button className="btn-secondary" onClick={()=>updateBattery(selectedBattery.id,{status:'Maintenance'})}>{t.setMaintenance}</button>
                <button className="btn-danger" onClick={()=>updateBattery(selectedBattery.id,{status:'Fault'})}>{t.setFault}</button>
              </div>
              {editingBattery ? <form className="stack-form battery-edit-form" onSubmit={saveBatteryDetails}>
                <strong>{language==='ar'?'تعديل المواصفات والقراءات المسجلة':'Edit specifications and recorded readings'}</strong>
                <label>{t.manufacturer}<input name="manufacturer" defaultValue={selectedBattery.manufacturer}/></label>
                <label>{language==='ar'?'الموديل':'Model'}<input name="model" defaultValue={selectedBattery.model}/></label>
                <label>{language==='ar'?'كيمياء الخلية':'Chemistry'}<input name="chemistry" defaultValue={selectedBattery.chemistry}/></label>
                <label>{language==='ar'?'الجهد الاسمي':'Nominal voltage'}<input name="nominalVoltage" defaultValue={selectedBattery.nominalVoltage}/></label>
                <label>{language==='ar'?'السعة':'Capacity'}<input name="capacity" defaultValue={selectedBattery.capacity}/></label>
                <div className="form-grid compact">
                  <label>SOC %<input name="soc" type="number" min="0" max="100" step="0.1" defaultValue={selectedBattery.soc ?? ''}/></label>
                  <label>SOH %<input name="soh" type="number" min="0" max="100" step="0.1" defaultValue={selectedBattery.soh ?? ''}/></label>
                  <label>{language==='ar'?'الحرارة °C':'Temperature °C'}<input name="temperature" type="number" step="0.1" defaultValue={selectedBattery.temperature ?? ''}/></label>
                  <label>{language==='ar'?'الجهد المقاس V':'Measured voltage V'}<input name="voltage" type="number" step="0.1" defaultValue={selectedBattery.voltage ?? ''}/></label>
                  <label>{language==='ar'?'التيار A':'Current A'}<input name="current" type="number" step="0.1" defaultValue={selectedBattery.current ?? ''}/></label>
                  <label>{language==='ar'?'عدد الدورات':'Cycles'}<input name="cycles" type="number" min="0" step="1" defaultValue={selectedBattery.cycles ?? ''}/></label>
                </div>
                <label>{t.notes}<textarea name="notes" defaultValue={selectedBattery.notes}/></label>
                <div className="record-actions"><button className="btn-primary" type="submit">{language==='ar'?'حفظ البيانات':'Save battery data'}</button><button className="btn-secondary" type="button" onClick={()=>setEditingBattery(false)}>{t.cancel}</button></div>
              </form> : <button className="btn-secondary full" onClick={()=>setEditingBattery(true)}>{language==='ar'?'تعديل بيانات البطارية':'Edit battery details'}</button>}
              {pendingBatteryArchive===selectedBattery.id ? <div className="archive-confirm"><strong>{language==='ar'?'تأكيد أرشفة البطارية؟':'Archive this battery record?'}</strong><button className="btn-danger" onClick={()=>archiveBattery(selectedBattery.id)}>{language==='ar'?'تأكيد الأرشفة':'Confirm archive'}</button><button className="btn-secondary" onClick={()=>setPendingBatteryArchive(null)}>{t.cancel}</button></div> : <button className="btn-danger full" onClick={()=>setPendingBatteryArchive(selectedBattery.id)}>{language==='ar'?'أرشفة البطارية':'Archive battery'}</button>}
            </>}
            <p className="muted-text">{t.localChanges}</p>
          </div>
        </div>
        <div className="surface-card add-asset-card"><div className="card-head"><div><span className="eyebrow">REGISTER BATTERY / NEW MODULE</span><h3>{language==='ar'?'إضافة بطارية جديدة':'Register a new battery'}</h3></div><Icon name="plus" size={20}/></div>
          <form className="form-grid" onSubmit={addBattery}>
            <label>{t.manufacturer}<input name="manufacturer" required placeholder="Cassioli / Craftsman / ACME"/></label>
            <label>{language==='ar'?'الموديل':'Model'}<input name="model" placeholder="Not recorded"/></label>
            <label>{language==='ar'?'نوع الخلايا':'Chemistry'}<input name="chemistry" defaultValue="Lithium-ion (unverified)"/></label>
            <label>{language==='ar'?'الجهد الاسمي':'Nominal voltage'}<input name="voltage" placeholder="Not recorded"/></label>
            <label>{language==='ar'?'السعة':'Capacity'}<input name="capacity" placeholder="Not recorded"/></label>
            <label>{language==='ar'?'تخصيص إلى جهاز':'Assign to shuttle'}<select name="assignment" defaultValue=""><option value="">{language==='ar'?'بطارية احتياطية':'Unassigned / spare'}</option>{activeShuttles.map(item=><option key={item.id} value={item.id}>{item.id} · {item.manufacturer}</option>)}</select></label>
            <label>{t.notes}<input name="notes" placeholder={t.noData}/></label>
            <button className="btn-primary" type="submit">{language==='ar'?'حفظ البطارية':'Save battery'}</button>
          </form>
        </div>
        <div className="archive-panel"><button className="text-button" type="button" onClick={()=>setShowArchived(value=>!value)}>{showArchived?(language==='ar'?'إخفاء أرشيف البطاريات':'Hide battery archive'):(language==='ar'?'عرض البطاريات المؤرشفة':'Show archived batteries')} · {archivedBatteries.length}</button>
          {showArchived && archivedBatteries.map(item=><div className="archive-row" key={item.id}><div><strong>{item.id}</strong><small>{item.manufacturer} · {item.assignment}</small></div><button className="btn-secondary" onClick={()=>restoreBattery(item.id)}>{language==='ar'?'استعادة':'Restore'}</button></div>)}
        </div>
      </section>}

      {activeTab === 'faults' && <section className="page-content">
        <PageIntro eyebrow="RELIABILITY / FAILURE ANALYSIS" title={t.faults} subtitle={t.faultSub}/>
        <div className="two-column-page"><div className="surface-card"><div className="card-head"><div><span className="eyebrow">FAULT LOG</span><h3>{t.newFaults}</h3></div><span className="counter">{faults.filter(f=>f.status!=='Resolved').length}</span></div><div className="record-stack">{faults.map(f=><div className="fault-record" key={f.id}><div className="record-top"><div><span className="eyebrow">{f.id} · {f.shuttleId}</span><h3>{f.title}</h3></div><div className="record-badges"><span className={'severity severity-'+f.severity.toLowerCase()}>{f.severity}</span><StatusPill status={f.status} language={language}/></div></div><p>{f.description}</p><div className="record-meta"><span>Cause: {f.probableCauses.join(', ')}</span><span>Assigned: {f.assignedTechnician}</span></div><div className="record-meta">Procedure: {f.diagnosticProcedure}</div>{!f.correctiveAction?.trim()?<form className="action-form" onSubmit={e=>recordCorrectiveAction(e,f.id)}><textarea name="action" placeholder={t.corrective} required/><button className="btn-secondary" type="submit">{t.saveAction}</button></form>:<div className="corrective-saved"><Icon name="check" size={15}/>{f.correctiveAction}</div>}<div className="record-actions"><button className="btn-secondary" disabled={f.status!=='Open'} onClick={()=>changeFaultStatus(f.id,'Investigating')}>{t.investigate}</button><button className="btn-primary" disabled={!f.correctiveAction?.trim()||f.status==='Resolved'} onClick={()=>changeFaultStatus(f.id,'Resolved')}>{t.resolve}</button></div></div>)}{faults.length===0&&<div className="empty-state">{t.noFaults}</div>}</div></div>
          <div className="surface-card"><div className="card-head"><div><span className="eyebrow">NEW FIELD REPORT</span><h3>{t.registerFault}</h3></div></div><form className="stack-form" onSubmit={addFault}><label>Shuttle<select name="shuttleId">{activeShuttles.map(s=><option key={s.id} value={s.id}>{s.id} · {s.manufacturer}</option>)}</select></label><label>{t.faultTitle}<input name="title" required/></label><label>{t.severity}<select name="severity"><option>Critical</option><option>Major</option><option>Moderate</option><option>Minor</option></select></label><label>{t.description}<textarea name="description" required/></label><label>{t.probableCause}<input name="cause"/></label><label>{t.procedure}<textarea name="procedure"/></label><label>{t.technician}<input name="technician"/></label><button className="btn-primary" type="submit">{t.registerFault}</button></form></div></div>
      </section>}

      {activeTab === 'maintenance' && <section className="page-content">
        <PageIntro eyebrow="MAINTENANCE / WORK MANAGEMENT" title={t.maintenance} subtitle={t.maintenanceSub}/>
        <div className="two-column-page"><div className="surface-card"><div className="card-head"><div><span className="eyebrow">WORK ORDER QUEUE</span><h3>{t.backlog}</h3></div><span className="counter">{jobs.filter(j=>j.status!=='Completed').length}</span></div><div className="record-stack">{jobs.map(j=><div className="work-record" key={j.id}><div className="record-top"><div><span className="eyebrow">{j.id} · {j.shuttleId}</span><h3>{j.title}</h3></div><StatusPill status={j.status} language={language}/></div><div className="record-meta"><span>Type: {j.type}</span><span>Date: {j.scheduledDate}</span><span>Technician: {j.technician}</span></div><p>{j.notes}</p><div className="record-actions"><button className="btn-secondary" disabled={j.status!=='Scheduled'} onClick={()=>changeJobStatus(j.id,'In Progress')}>{t.startWork}</button><button className="btn-primary" disabled={j.status==='Completed'} onClick={()=>changeJobStatus(j.id,'Completed')}>{t.completeWork}</button></div></div>)}{jobs.length===0&&<div className="empty-state">{t.noWork}</div>}</div></div>
          <div className="surface-card"><div className="card-head"><div><span className="eyebrow">PLANNED SERVICE</span><h3>{t.createWork}</h3></div></div><form className="stack-form" onSubmit={addJob}><label>Shuttle<select name="shuttleId">{activeShuttles.map(s=><option key={s.id} value={s.id}>{s.id} · {s.manufacturer}</option>)}</select></label><label>{t.workTitle}<input name="title" required/></label><label>Type<select name="type"><option>Preventive</option><option>Corrective</option></select></label><label>{t.date}<input name="date" type="date" required/></label><label>{t.technician}<input name="technician"/></label><label>{t.notes}<textarea name="notes"/></label><button className="btn-primary" type="submit">{language === 'ar' ? 'حفظ أمر الصيانة' : 'Save work order'}</button></form></div></div>
      </section>}

      {activeTab === 'connections' && <section className="page-content"><PageIntro eyebrow="INDUSTRIAL NETWORK / INTEGRATION" title={language==='ar'?'معمارية الاتصال بالمعدات':'Device integration architecture'} subtitle={t.connectionSub}/><div className="protocol-grid">{initialConnections.map((c,i)=><div className="surface-card protocol-card" key={c.name}><div className="protocol-icon"><Icon name="network" size={23}/></div><div className="protocol-index">0{i+1}</div><h3>{c.protocol}</h3><strong>{c.name}</strong><p>{c.notes}</p><div className="protocol-footer"><StatusPill status={c.mode} language={language}/><span>{t.notConfigured}</span></div></div>)}</div><div className="notice-inline"><Icon name="alert"/>{language==='ar'?'قبل تفعيل أي اتصال: يلزم دليل المصنع، وخريطة العناوين، وبيانات الشبكة، وتصريح فني. البداية قراءة فقط.':'Before enabling a connection: obtain vendor interface manuals, register/address maps, network details and engineering authorization. Begin read-only.'}</div></section>}

      {activeTab === 'ai' && <section className="page-content"><PageIntro eyebrow="ENGINEERING SUPPORT / DECISION ASSISTANCE" title={language==='ar'?'المساعد الفني والهندسي':'Technical engineering assistant'} subtitle={t.aiSub}/><div className="assistant-layout"><div className="surface-card assistant-main"><div className="assistant-mark"><Icon name="spark" size={28}/></div><span className="eyebrow">ENGINEERING CHECKLIST · NOT AI GENERATED</span><h2>{language==='ar'?'مسار فحص مبدئي لعربة Craftsman':'Craftsman field verification checklist'}</h2><p>{language==='ar'?'البلاغات المسجلة تشمل عدم قراءة الطبالي الخشبية، وسحب البطارية، والإنذارات الكاذبة، وانزلاق العجلات على الثلج، وفصل الحساسات والتوقف المفاجئ. لا يمكن تحديد السبب من هذه المعلومات وحدها.':'Reported observations include wooden pallet recognition problems, rapid battery drain, false alarms, wheel slip on ice, sensor cut-outs and sudden stops. These observations alone do not establish a root cause.'}</p><div className="checklist">{['Inspect sensor lenses, mounting and detection field','Verify wooden pallet detection with known-good samples','Capture battery voltage/current trend under controlled load','Inspect wheel tread, bearings and ice contamination','Review safety interlocks and event logs before return to service'].map((x,i)=><div className="check-row" key={x}><span>0{i+1}</span><p>{x}</p><StatusPill status="Unknown" language={language}/></div>)}</div><div className="notice-inline"><Icon name="alert"/> {t.modelDisclaimer}</div></div><div className="surface-card assistant-side"><div className="card-head"><div><span className="eyebrow">ASSISTANT STATUS</span><h3>AI PROVIDER</h3></div><span className="status-pill status-unknown">NOT CONNECTED</span></div><p className="muted-text">{language==='ar'?'لم يتم ربط Gemini أو أي مزود ذكاء اصطناعي. المحتوى المعروض قائمة فحص ثابتة ولا يمثل تشخيصًا آليًا.':'Gemini or another AI provider is not configured. The displayed content is a static checklist, not an automated diagnosis.'}</p><div className="assistant-info"><Detail label="Mode" value="Advisory only"/><Detail label="Source" value="Manual field reports"/><Detail label="Machine control" value="Disabled"/></div></div></div></section>}

      {activeTab === 'reports' && <section className="page-content">
        <PageIntro eyebrow="OPERATIONS INTELLIGENCE / DAILY MANAGEMENT" title={language==='ar'?'التقارير اليومية وحالة الأجهزة':'Daily operations and equipment reports'} subtitle={language==='ar'?'لقطة يومية لحالة كل جهاز وبطارية والأعطال وأوامر الصيانة، قابلة للتصدير والطباعة.':'A dated snapshot of every active shuttle and battery, faults and maintenance work, ready to export or print.'}/>
        <div className="report-toolbar">
          <button className="btn-primary" onClick={generateDailyReport}><Icon name="chart" size={16}/>{language==='ar'?'إصدار التقرير اليومي الآن':'Generate today’s report'}</button>
          <button className="btn-secondary" onClick={exportCsv}>{t.exportCsv}</button>
          <button className="btn-secondary" onClick={exportBackup}>{t.backup}</button>
          <button className="btn-secondary" onClick={()=>window.print()}>{t.print}</button>
        </div>
        <div className="report-metrics">
          <Metric icon="truck" label={language==='ar'?'الأجهزة النشطة':'Active shuttles'} value={activeShuttles.length} accent="blue"/>
          <Metric icon="alert" label={language==='ar'?'الأعطال المفتوحة':'Open faults'} value={faults.filter(f=>f.status!=='Resolved').length} accent="red"/>
          <Metric icon="wrench" label={language==='ar'?'أوامر صيانة مفتوحة':'Open work orders'} value={jobs.filter(j=>j.status!=='Completed').length} accent="amber"/>
          <Metric icon="battery" label={language==='ar'?'البطاريات النشطة':'Active batteries'} value={activeBatteries.length} accent="cyan"/>
        </div>
        {dailyReports[0] && <div className="surface-card latest-report-card">
          <div className="card-head"><div><span className="eyebrow">{language==='ar'?'آخر تقرير محفوظ':'LATEST SAVED DAILY REPORT'}</span><h3>{dailyReports[0].reportDate} · {dailyReports[0].id}</h3></div><span className="status-pill status-unknown">LOCAL SNAPSHOT</span></div>
          <div className="report-metrics compact-metrics">
            <Metric icon="truck" label={language==='ar'?'الأجهزة':'Shuttles'} value={dailyReports[0].shuttleCount} accent="blue"/>
            <Metric icon="grid" label={language==='ar'?'تعمل':'Running'} value={dailyReports[0].runningCount} accent="green"/>
            <Metric icon="alert" label={language==='ar'?'أعطال مفتوحة':'Open faults'} value={dailyReports[0].openFaultCount} accent="red"/>
            <Metric icon="battery" label={language==='ar'?'بطاريات بها عطل':'Faulted batteries'} value={dailyReports[0].faultedBatteryCount} accent="amber"/>
          </div>
          <p className="muted-text">{language==='ar'?'وقت الإصدار: ':'Generated: '}{formatNotificationTime(dailyReports[0].generatedAt)} · {language==='ar'?'مصادر القياس المؤكدة: ':'Verified telemetry sources: '}{dailyReports[0].verifiedTelemetryCount}</p>
          <button className="btn-primary" onClick={()=>downloadDailyReport(dailyReports[0])}>{language==='ar'?'تنزيل التقرير CSV':'Download daily report CSV'}</button>
        </div>}
        <div className="surface-card"><div className="card-head"><div><span className="eyebrow">CURRENT REGISTER / LIVE STATUS NOT AVAILABLE</span><h3>{language==='ar'?'حالة الأجهزة الحالية':'Current shuttle status register'}</h3></div><span className="status-pill status-unknown">LOCAL RECORDS</span></div>
          <div className="table-wrap"><table><thead><tr><th>ID</th><th>{t.manufacturer}</th><th>{t.model}</th><th>{t.status}</th><th>{t.communication}</th><th>{t.zone}</th></tr></thead><tbody>{activeShuttles.map(item=><tr key={item.id}><td>{item.id}</td><td>{item.manufacturer}</td><td>{item.model}</td><td><StatusPill status={item.status} language={language}/></td><td>{item.connectivity}</td><td>{item.warehouseZone}</td></tr>)}</tbody></table></div>
        </div>
        <div className="surface-card"><div className="card-head"><div><span className="eyebrow">BATTERY REGISTER</span><h3>{language==='ar'?'حالة البطاريات الحالية':'Current battery register'}</h3></div></div>
          <div className="table-wrap"><table><thead><tr><th>ID</th><th>{t.manufacturer}</th><th>{t.status}</th><th>{language==='ar'?'التخصيص':'Assignment'}</th><th>SOC</th><th>{t.communication}</th></tr></thead><tbody>{activeBatteries.map(item=><tr key={item.id}><td>{item.id}</td><td>{item.manufacturer}</td><td>{item.status}</td><td>{item.assignment}</td><td>{item.soc===null?t.unknown:item.soc+'%'}</td><td>{item.connectionMode}</td></tr>)}</tbody></table></div>
        </div>
        <div className="surface-card"><div className="card-head"><div><span className="eyebrow">REPORT ARCHIVE</span><h3>{language==='ar'?'أرشيف التقارير اليومية':'Daily report history'}</h3></div><span className="counter">{dailyReports.length}</span></div>
          {dailyReports.length===0 ? <div className="empty-state">{language==='ar'?'لم يتم إصدار تقارير بعد. اضغط إصدار التقرير اليومي لإنشاء أول لقطة محفوظة.':'No reports yet. Generate today’s report to create the first saved snapshot.'}</div> :
            dailyReports.map(report=><div className="archive-row report-history-row" key={report.id}><div><strong>{report.reportDate} · {report.id}</strong><small>{formatNotificationTime(report.generatedAt)} · {report.shuttleCount} units · {report.openFaultCount} open faults</small></div><button className="btn-secondary" onClick={()=>downloadDailyReport(report)}>{language==='ar'?'تنزيل CSV':'Download CSV'}</button></div>)}
        </div>
        <p className="muted-text">{language==='ar'?'كل تقرير لقطة محفوظة لحظة الإصدار ولا يتغير تلقائيًا بعد ذلك. القيم غير الموثقة تظل غير معروفة ولا تُستبدل بأرقام تقديرية.':'Each report is a frozen snapshot from its creation time. Unverified values remain unknown and are never replaced with estimates.'}</p>
      </section>}

      {activeTab === 'notifications' && <section className="page-content">
        <PageIntro eyebrow="EVENT CENTER / ALERTS" title={language==='ar'?'مركز الإشعارات':'Notifications center'} subtitle={language==='ar'?'تنبيهات محلية من بلاغات الأعطال والبطاريات وأوامر الصيانة.':'Local alerts created by fault, battery and maintenance record changes.'}/>
        <div className="notification-toolbar">
          <div><span className="eyebrow">{language==='ar'?'سجل التنبيهات المحلية':'LOCAL EVENT LOG'}</span><strong>{notifications.length} {language==='ar'?'تنبيه':'notifications'}</strong></div>
          <button className="btn-secondary" type="button" onClick={clearNotifications} disabled={notifications.length===0}>{language==='ar'?'مسح جميع التنبيهات':'Clear all notifications'}</button>
        </div>
        {notifications.length===0
          ? <div className="surface-card empty-state"><Icon name="bell" size={34}/><h3>{t.noNotifications}</h3><p>{language==='ar'?'سيظهر التنبيه هنا عند تسجيل عطل أو تحديث بطارية أو أمر صيانة.':'New local notifications appear here when faults, battery states or work orders are updated.'}</p></div>
          : <div className="notification-list">{notifications.map(item=><article className={'surface-card notification-card notification-'+item.severity} key={item.id}>
              <div className="notification-mark"><Icon name={item.severity==='error'?'alert':item.severity==='warning'?'bell':'check'} size={18}/></div>
              <div className="notification-body"><div className="notification-heading"><h3>{item.title}</h3><span className={'severity severity-'+item.severity}>{item.severity.toUpperCase()}</span></div><p>{item.detail}</p><time dateTime={item.time}>{formatNotificationTime(item.time)}</time></div>
              <button className="notification-dismiss" type="button" onClick={()=>dismissNotification(item.id)} aria-label={language==='ar'?'إزالة التنبيه':'Dismiss notification'}>{language==='ar'?'إزالة':'Dismiss'}</button>
            </article>)}</div>}
        <p className="muted-text">{language==='ar'?'هذه تنبيهات محلية محفوظة على هذا الجهاز، وليست إشعارات فورية من وحدات التحكم أو المعدات.':'These notifications are stored locally on this device; they are not push alerts from PLCs or physical equipment.'}</p>
      </section>}

      {activeTab === 'users' && <section className="page-content"><PageIntro eyebrow="IDENTITY / ACCESS PREVIEW" title={language==='ar'?'المستخدمون والأمان':'Users & security'} subtitle={t.roleNotice}/><div className="user-grid">{users.map(u=><button className={'surface-card user-card '+(currentUser.role===u.role?'selected':'')} key={u.id} onClick={()=>setCurrentUser(u)}><div className="avatar large">{u.name.split(' ').map(v=>v[0]).join('').slice(0,2)}</div><h3>{u.name}</h3><p>{u.role}</p><span>{u.email}</span></button>)}</div><div className="notice-inline"><Icon name="alert"/>{t.noUsers}</div></section>}

      {activeTab === 'settings' && <section className="page-content"><PageIntro eyebrow="APPLICATION / PREFERENCES" title={language==='ar'?'إعدادات النظام':'System settings'} subtitle={language==='ar'?'تخصيص العرض واللغة والتنبيهات المحلية وتصدير البيانات.':'Configure appearance, local alert preferences and local data exports.'}/><div className="settings-grid">
        <div className="surface-card"><h3>{t.language}</h3><div className="choice-row"><button className={language==='en'?'selected':''} onClick={()=>setLanguage('en')}>English</button><button className={language==='ar'?'selected':''} onClick={()=>setLanguage('ar')}>العربية</button></div></div>
        <div className="surface-card"><h3>{t.theme}</h3><div className="choice-row"><button className={theme==='dark'?'selected':''} onClick={()=>setTheme('dark')}>{t.dark}</button><button className={theme==='light'?'selected':''} onClick={()=>setTheme('light')}>{t.light}</button></div></div>
        <div className="surface-card"><h3>{t.role}</h3><select value={currentUser.role} onChange={e=>setCurrentUser(users.find(u=>u.role===e.target.value as Role)||users[0])}>{users.map(u=><option key={u.id} value={u.role}>{u.role}</option>)}</select><p className="muted-text">{t.roleNotice}</p></div>
        <div className="surface-card notification-preferences"><h3>{language==='ar'?'تفضيلات التنبيه':'Notification preferences'}</h3>
          {([
            {key:'notificationsEnabled' as const,en:'Enable local notifications',ar:'تفعيل التنبيهات المحلية',descEn:'Master switch for notifications generated by this app.',descAr:'المفتاح الرئيسي للتنبيهات التي ينشئها التطبيق.'},
            {key:'maintenanceReminders' as const,en:'Maintenance reminders',ar:'تذكيرات الصيانة',descEn:'Notify when work orders are created or change state.',descAr:'تنبيه عند إنشاء أو تحديث أوامر الصيانة.'},
            {key:'batteryAlerts' as const,en:'Battery alerts',ar:'تنبيهات البطاريات',descEn:'Notify when a battery record status changes.',descAr:'تنبيه عند تغيير حالة سجل البطارية.'},
            {key:'communicationAlerts' as const,en:'Communication alerts',ar:'تنبيهات الاتصال',descEn:'Notify when a shuttle communication record changes.',descAr:'تنبيه عند تغيير سجل اتصال عربة الشاتل.'}
          ]).map(item=><label className="setting-toggle" key={item.key}><span><strong>{language==='ar'?item.ar:item.en}</strong><small>{language==='ar'?item.descAr:item.descEn}</small></span><input type="checkbox" checked={settings[item.key]} onChange={event=>setSettings(prev=>({...prev,[item.key]:event.target.checked}))}/></label>)}
        </div>
        <div className="surface-card"><h3>{language==='ar'?'النسخ الاحتياطي واستعادة البيانات':'Backup and restore'}</h3><p className="muted-text">{language==='ar'?'صدّر كل سجلات الأجهزة والبطاريات والأعطال والصيانة والتقارير. يمكن استيراد ملف JSON صادر من التطبيق.':'Export shuttle, battery, fault, maintenance and daily report data. Restore a JSON backup previously exported by this app.'}</p><div className="settings-action-row"><button className="btn-primary" onClick={exportBackup}>{t.backup}</button><label className="file-import-button">{language==='ar'?'استعادة من ملف JSON':'Restore from JSON'}<input aria-label={language==='ar'?'استعادة نسخة احتياطية':'Restore backup'} type="file" accept="application/json,.json" onChange={importBackup}/></label></div></div>
        <div className="surface-card"><h3>{language==='ar'?'حالة قاعدة البيانات المحلية':'Local data store'}</h3><div className="spec-list"><Detail label={language==='ar'?'أجهزة نشطة':'Active shuttles'} value={activeShuttles.length}/><Detail label={language==='ar'?'أجهزة مؤرشفة':'Archived shuttles'} value={archivedShuttles.length}/><Detail label={language==='ar'?'بطاريات نشطة':'Active batteries'} value={activeBatteries.length}/><Detail label={language==='ar'?'تقارير يومية محفوظة':'Saved daily reports'} value={dailyReports.length}/><Detail label={language==='ar'?'مكان التخزين':'Storage'} value="This device · Local browser storage"/></div><p className="muted-text">{language==='ar'?'لا توجد مزامنة سحابية أو قاعدة بيانات مشتركة حاليًا. احتفظ بنسخة احتياطية على وسيط خارجي.':'There is no cloud sync or shared database yet. Keep a backup on a separate storage location.'}</p></div>
        <div className="surface-card danger-settings"><h3>{language==='ar'?'إعادة بيانات التطبيق':'Reset local records'}</h3><p className="muted-text">{language==='ar'?'إعادة السجلات المحلية إلى بيانات البداية. لا يمكن التراجع عن ذلك دون نسخة احتياطية.':'Restore local records to the original seed data. This cannot be undone without a backup.'}</p><button className="btn-danger" onClick={resetLocalData}>{language==='ar'?'إعادة بيانات البداية':'Reset local records'}</button></div>
      </div></section>}

      <footer className="app-footer"><span>SHUTTLE OPS · V10 OPERATIONS PLATFORM</span><span>{t.dataNotice}</span></footer>
    </main>
    {mobileNav && <button className="nav-scrim" onClick={()=>setMobileNav(false)} aria-label="Close navigation overlay"/>}
    {toast && <div className="toast"><Icon name="check"/>{toast}</div>}
  </div>;
}

function Metric({ icon, label, value, accent, detail }: { icon: string; label: string; value: React.ReactNode; accent: string; detail?: string }) {
  return <div className="metric-card"><div className={'metric-icon '+accent}><Icon name={icon}/></div><span>{label}</span><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>;
}
function PageIntro({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div>;
}
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="detail-item"><span>{label}</span><strong>{value || 'Not recorded'}</strong></div>;
}
function ComponentRow({ n, title, desc }: { n: string; title: string; desc: string }) {
  return <div className="component-row"><span>{n}</span><div><strong>{title}</strong><small>{desc}</small></div><Icon name="chevron" size={15}/></div>;
}
export default App;
