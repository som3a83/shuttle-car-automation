import React, { useEffect, useMemo, useState } from 'react';
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
import type {
  AppSettings,
  Battery,
  Fault,
  Language,
  MaintenanceJob,
  Role,
  Shuttle,
  ShuttleStatus,
  Theme
} from './types';

type Tab = 'dashboard' | 'fleet' | 'engineering' | 'batteries' | 'faults' | 'maintenance' | 'connections' | 'ai' | 'reports' | 'notifications' | 'users' | 'settings';
type ModelView = 'iso' | 'side' | 'front' | 'top';

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
    fleet: 'Fleet overview', fleetSub: 'Five registered assets · 3 Cassioli · 1 Craftsman · 1 ACME',
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
    fleet: 'ملخص الأسطول', fleetSub: '5 عربات مسجلة · 3 كاسيولي · 1 كرافتسمان · 1 إيه سي إم إي',
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

const PREFIX = 'shuttle-car-automation-v7:';
function readLocal<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(PREFIX + key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { return fallback; }
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
  return <span className={'status-pill status-' + String(status).toLowerCase().replaceAll(' ', '-')}>{map[status] || status}</span>;
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
    <path d="M190 104h380v190H190z" rx="22" fill="#344353" stroke="#9aaabb" strokeWidth="4"/>
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

function BatteryPack({ battery }: { battery: Battery }) {
  const soc = battery?.soc;
  return <div className="battery-render">
    <div className="battery-cap"><span/><span/></div>
    <div className="battery-case">
      <div className="battery-handle"/>
      <div className="battery-cells">{Array.from({length:12}).map((_,i)=><div key={i} className="battery-cell" style={{opacity: soc === null ? .27 : i < Math.round(soc / 100 * 12) ? 1 : .2}}/>)}</div>
      <div className="battery-leds"><i/><i/><i/></div>
    </div>
    <div className="battery-render-label">{battery?.model || 'BATTERY MODULE'} · {soc === null ? 'SOC NOT VERIFIED' : soc + '% REPORTED'}</div>
  </div>;
}

function App() {
  const [language, setLanguage] = useState<Language>(() => readLocal('language', 'en'));
  const [theme, setTheme] = useState<Theme>(() => readLocal('theme', 'dark'));
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
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
  const [exploded, setExploded] = useState(false);
  const [animated, setAnimated] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const [newAsset, setNewAsset] = useState({ manufacturer: 'Cassioli', zone: '', notes: '' });

  const t = copy[language];
  const selected = shuttles.find(s => s.id === selectedId) || shuttles[0];
  const selectedBattery = batteries.find(b => b.id === selectedBatteryId) || batteries[0] || initialBatteries[0];
  const filteredShuttles = useMemo(() => shuttles.filter(s => {
    const q = search.toLowerCase();
    const matchText = [s.id, s.manufacturer, s.warehouseZone].some(v => v.toLowerCase().includes(q));
    return matchText && (statusFilter === 'ALL' || s.status === statusFilter);
  }), [shuttles, search, statusFilter]);

  useEffect(() => {
    const values: Record<string, unknown> = { language, theme, shuttles, batteries, faults, maintenance: jobs, notifications, settings };
    try { Object.entries(values).forEach(([key, value]) => localStorage.setItem(PREFIX + key, JSON.stringify(value))); } catch { /* local storage is optional */ }
  }, [language, theme, shuttles, batteries, faults, jobs, notifications, settings]);

  const metrics = {
    total: shuttles.length,
    running: shuttles.filter(s => s.status === 'Running').length,
    idle: shuttles.filter(s => s.status === 'Idle' || s.status === 'Ready').length,
    faulted: faults.filter(f => f.status !== 'Resolved').length,
    disconnected: shuttles.filter(s => s.connectivity !== 'REAL').length,
    verifiedSoc: batteries.filter(b => b.soc !== null).length
  };

  const go = (tab: Tab) => { setActiveTab(tab); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  const updateShuttle = (id: string, patch: Partial<Shuttle>) => setShuttles(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  const updateBattery = (id: string, patch: Partial<Battery>) => setBatteries(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));

  const addShuttle = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = 'SC-' + String(Math.max(0, ...shuttles.map(s => Number(s.id.replace('SC-', '')) || 0)) + 1).padStart(2, '0');
    const record: Shuttle = {
      id, manufacturer: newAsset.manufacturer as Shuttle['manufacturer'], model: 'Not recorded',
      serialNumber: 'Not recorded', hardwareVersion: 'Not recorded', firmwareVersion: 'Not recorded',
      warehouseZone: newAsset.zone.trim() || 'Not recorded', status: 'Unknown', connectivity: 'UNKNOWN',
      installedBattery: 'Not recorded', operatingHours: 0, operatingCycles: 0, faultHistory: [],
      maintenanceHistory: [], assignedOperator: 'Not assigned', lastCommunication: 'Not connected',
      notes: newAsset.notes.trim() || 'New local asset record. Equipment identity and telemetry are not verified.'
    };
    setShuttles(prev => [...prev, record]); setSelectedId(id); setNewAsset({ manufacturer: 'Cassioli', zone: '', notes: '' }); showToast(t.done);
  };

  const addFault = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const record: Fault = {
      id: 'FLT-' + Date.now(), shuttleId: String(form.get('shuttleId') || selected.id),
      title: String(form.get('title') || 'Reported fault'), severity: String(form.get('severity') || 'Moderate') as Fault['severity'],
      status: 'Open', timestamp: new Date().toISOString(), description: String(form.get('description') || ''),
      probableCauses: [String(form.get('cause') || 'Not established')], diagnosticProcedure: String(form.get('procedure') || 'Field verification required'),
      correctiveAction: '', assignedTechnician: String(form.get('technician') || 'Not assigned')
    };
    setFaults(prev => [record, ...prev]); event.currentTarget.reset(); showToast(t.done);
  };

  const addJob = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const job: MaintenanceJob = {
      id: 'MNT-' + Date.now(), shuttleId: String(form.get('shuttleId') || selected.id),
      title: String(form.get('title') || 'Inspection'), type: String(form.get('type') || 'Preventive') as MaintenanceJob['type'],
      status: 'Scheduled', scheduledDate: String(form.get('date') || ''), technician: String(form.get('technician') || 'Not assigned'),
      notes: String(form.get('notes') || '')
    };
    setJobs(prev => [job, ...prev]); event.currentTarget.reset(); showToast(t.done);
  };

  const recordCorrectiveAction = (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const action = String(form.get('action') || '').trim(); if (!action) return;
    setFaults(prev => prev.map(f => f.id === id ? { ...f, correctiveAction: action } : f)); event.currentTarget.reset(); showToast(t.done);
  };

  const statusText = (status: ShuttleStatus) => {
    const key: Record<ShuttleStatus, string> = { Ready: 'statusReady', Running: 'statusRunning', Idle: 'statusIdle', Charging: 'statusCharging', Maintenance: 'statusMaintenance', Fault: 'statusFault', Disconnected: 'statusDisconnected', Unknown: 'statusUnknown' };
    return t[key[status]];
  };

  const exportCsv = () => {
    const rows = [['Type','ID','Manufacturer','State','Connectivity','Notes'],
      ...shuttles.map(s => ['Shuttle',s.id,s.manufacturer,s.status,s.connectivity,s.notes]),
      ...batteries.map(b => ['Battery',b.id,b.manufacturer,b.status,b.connectionMode,b.notes]),
      ...faults.map(f => ['Fault',f.id,f.shuttleId,f.status,f.severity,f.description]),
      ...jobs.map(j => ['Maintenance',j.id,j.shuttleId,j.status,j.type,j.notes])];
    const csv = rows.map(row => row.map(value => '"' + String(value ?? '').replaceAll('"','""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'shuttle-register.csv'; link.click(); URL.revokeObjectURL(url);
  };
  const exportBackup = () => {
    const data = { schemaVersion: 7, exportedAt: new Date().toISOString(), warning: 'Local demo/record data only. Not a live PLC telemetry export.', shuttles, batteries, faults, jobs, notifications, settings };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'shuttle-local-backup.json'; link.click(); URL.revokeObjectURL(url);
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
        {navItems.filter(item => item.group === group).map(item => <button key={item.id} className={'nav-button ' + (activeTab === item.id ? 'active' : '')} onClick={() => go(item.id)}>
          <Icon name={item.icon}/><span>{language === 'ar' ? item.ar : item.en}</span>{activeTab === item.id && <i className="nav-active-mark"/>}
        </button>)}
      </div>)}
      <div className="sidebar-footer"><div className="connection-indicator"><i/> {language === 'ar' ? 'وضع محلي — غير متصل' : 'LOCAL MODE · OFFLINE'}</div><div className="sidebar-user"><div className="avatar">SA</div><div><strong>{currentUser.name}</strong><small>{currentUser.role}</small></div></div></div>
    </aside>

    <main className="workspace">
      <header className="topbar">
        <div className="topbar-heading"><button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Icon name="grid" size={20}/></button><div className="breadcrumb">SHUTTLE OPS <span>/</span> {language === 'ar' ? header?.ar : header?.en}</div><h1>{language === 'ar' ? header?.ar : header?.en}</h1></div>
        <div className="topbar-actions">
          <div className="system-chip"><i/> {language === 'ar' ? 'لا يوجد اتصال حي' : 'NO LIVE CONNECTION'}</div>
          <button className="language-toggle" onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}>{language === 'en' ? 'Arabic' : 'English'}</button>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}><Icon name="settings" size={16}/><span>{theme === 'dark' ? t.light : t.dark}</span></button>
        </div>
      </header>

      <nav className="mobile-nav" aria-label="Primary navigation">
        {navItems.slice(0, 6).map(item => <button key={item.id} className={activeTab === item.id ? 'active' : ''} onClick={() => go(item.id)}><Icon name={item.icon} size={16}/><span>{language === 'ar' ? item.ar : item.en}</span></button>)}
        <button onClick={() => setMobileNav(true)}><Icon name="grid" size={16}/><span>{language === 'ar' ? 'كل الأقسام' : 'All modules'}</span></button>
      </nav>

      <div className="demo-banner" role="status"><div className="demo-icon"><Icon name="alert" size={18}/></div><div><strong>{t.demo}</strong><p>{t.demoText}</p></div><span className="demo-tag">{t.unverified}</span></div>

      {activeTab === 'dashboard' && <section className="page-content">
        <div className="hero-panel">
          <div className="hero-copy"><div className="eyebrow"><span/> PRECISION INDUSTRIAL · MECHANICAL INTELLIGENCE</div><h2>{language === 'ar' ? 'تحكم هندسي في أسطول الشاتل' : 'Precision control for your shuttle fleet'}</h2><p>{language === 'ar' ? 'مركز موحد لمتابعة العربات والبطاريات والأعطال والصيانة، مع رسومات ميكانيكية تفاعلية.' : 'A unified workspace for shuttle assets, battery records, faults and maintenance — with interactive mechanical visualization.'}</p><div className="hero-actions"><button className="btn-primary" onClick={() => go('fleet')}>{t.openFleet}<Icon name="arrow" size={16}/></button><button className="btn-secondary" onClick={() => go('engineering')}>{t.openEngineering}</button></div><div className="hero-footnote"><span className="pulse-dot"/> {language === 'ar' ? '5 عربات مسجلة في السجل المحلي' : '5 assets registered in the local fleet register'}</div></div>
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
            <div className="mini-fleet">{shuttles.map(s => <button className="mini-asset" key={s.id} onClick={() => {setSelectedId(s.id);go('engineering');}}><div className={'mini-machine mini-' + s.manufacturer.toLowerCase()}><Icon name="truck" size={20}/></div><div className="mini-asset-info"><strong>{s.id}</strong><span>{s.manufacturer} · {s.model}</span></div><StatusPill status={s.status} language={language}/><Icon name="chevron" size={15}/></button>)}</div>
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
            {selected && <><div className="card-head"><div><span className="eyebrow">{t.selected}</span><h3>{selected.id}</h3></div><StatusPill status={selected.status} language={language}/></div><div className="selected-asset-visual"><ShuttleModel shuttle={selected} view="iso" exploded={false} animated={animated}/></div><div className="asset-detail-grid"><Detail label={t.manufacturer} value={selected.manufacturer}/><Detail label={t.model} value={selected.model}/><Detail label={t.serial} value={selected.serialNumber}/><Detail label={t.zone} value={selected.warehouseZone}/><Detail label={t.batteryPack} value={selected.installedBattery}/><Detail label={t.communication} value={selected.connectivity}/></div><div className="card-actions"><button className="btn-primary" onClick={() => go('engineering')}>{t.testView}<Icon name="arrow" size={15}/></button><select value={selected.status} onChange={e => updateShuttle(selected.id,{status:e.target.value as ShuttleStatus})}>{statusOptions.map(s=><option key={s} value={s}>{statusText(s)}</option>)}</select></div><p className="muted-text">{t.localChanges}</p></>}
          </div>
        </div>
        <div className="surface-card add-asset-card"><div className="card-head"><div><span className="eyebrow">REGISTER NEW EQUIPMENT</span><h3>{t.addShuttle}</h3></div><Icon name="plus" size={20}/></div><form className="inline-form" onSubmit={addShuttle}><label>{t.manufacturer}<select value={newAsset.manufacturer} onChange={e=>setNewAsset({...newAsset,manufacturer:e.target.value})}><option>Cassioli</option><option>Craftsman</option><option>ACME</option></select></label><label>{t.zone}<input value={newAsset.zone} onChange={e=>setNewAsset({...newAsset,zone:e.target.value})} placeholder={t.noData}/></label><label>{t.notes}<input value={newAsset.notes} onChange={e=>setNewAsset({...newAsset,notes:e.target.value})} placeholder={t.noData}/></label><button className="btn-primary" type="submit">{t.save}</button></form><p className="muted-text">{t.dataNotice}</p></div>
      </section>}

      {activeTab === 'engineering' && selected && <section className="page-content">
        <PageIntro eyebrow="MECHANICAL INTELLIGENCE / DIGITAL SCHEMATIC" title={t.engineering} subtitle={t.engineeringSub}/>
        <div className="engineering-workspace">
          <div className="surface-card model-stage">
            <div className="model-toolbar"><div className="asset-select"><label>{t.selectAsset}</label><select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{shuttles.map(s=><option key={s.id} value={s.id}>{s.id} — {s.manufacturer}</option>)}</select></div><div className="model-tools"><button className={exploded?'tool-active':''} onClick={()=>setExploded(!exploded)}><Icon name="settings" size={15}/>{t.exploded}</button><button className={animated?'tool-active':''} onClick={()=>setAnimated(!animated)}><Icon name="grid" size={15}/>{animated?t.stop:t.animate}</button></div></div>
            <div className="view-tabs">{(['iso','side','front','top'] as ModelView[]).map(v=><button key={v} className={modelView===v?'active':''} onClick={()=>setModelView(v)}>{t[v]}</button>)}</div>
            <div className="model-canvas"><div className="canvas-topline"><span>MODEL: {selected.manufacturer.toUpperCase()} / {selected.id}</span><span>REV 0.1 · CONCEPTUAL</span></div><ShuttleModel shuttle={selected} view={modelView} exploded={exploded} animated={animated}/><div className="canvas-bottomline"><span><i className="legend-dot" style={{background:selected.manufacturer==='Cassioli'?'#d28b4b':selected.manufacturer==='Craftsman'?'#45b8d2':'#a58af5'}}/>{selected.manufacturer}</span><span><i className="legend-dot" style={{background:'#75d6ff'}}/>Sensors</span><span><i className="legend-dot" style={{background:'#7bd9a9'}}/>Battery module</span></div></div>
            <p className="disclaimer">{t.modelDisclaimer}</p>
          </div>
          <div className="engineering-side">
            <div className="surface-card"><div className="card-head"><div><span className="eyebrow">ASSET IDENTITY</span><h3>{selected.id}</h3></div><StatusPill status={selected.status} language={language}/></div><div className="spec-list"><Detail label={t.manufacturer} value={selected.manufacturer}/><Detail label={t.model} value={selected.model}/><Detail label={t.serial} value={selected.serialNumber}/><Detail label="Hardware / firmware" value={selected.hardwareVersion + ' / ' + selected.firmwareVersion}/><Detail label={t.batteryPack} value={selected.installedBattery}/><Detail label={t.lastSeen} value={selected.lastCommunication}/></div></div>
            <div className="surface-card"><div className="card-head"><div><span className="eyebrow">ASSEMBLY BREAKDOWN</span><h3>{t.componentLegend}</h3></div></div><div className="component-list"><ComponentRow n="01" title={t.chassis} desc="Structural frame / load deck"/><ComponentRow n="02" title={t.drive} desc="Drive train / motor housing"/><ComponentRow n="03" title={t.wheel} desc="Traction and guide wheel sets"/><ComponentRow n="04" title={t.batteryComp} desc="Removable energy module"/><ComponentRow n="05" title={t.sensors} desc="Detection / protection points"/></div></div>
          </div>
        </div>
      </section>}

      {activeTab === 'batteries' && <section className="page-content">
        <PageIntro eyebrow="ENERGY SYSTEMS / BATTERY REGISTER" title={language==='ar'?'منظومة البطاريات':'Battery systems'} subtitle={language==='ar'?'عرض ميكانيكي لحزمة الليثيوم وسجل الحالة والتخصيص.':'Lithium pack visualization, status register and assignment history.'}/>
        {batteries.length === 0 ? <div className="surface-card empty-state">{t.noBattery}</div> : <div className="battery-layout">
          <div className="surface-card battery-stage"><div className="card-head"><div><span className="eyebrow">BATTERY MODULE / {selectedBattery?.id}</span><h3>{t.batteryIllustration}</h3></div><StatusPill status={selectedBattery?.status || 'Unknown'} language={language}/></div><BatteryPack battery={selectedBattery}/><div className="battery-stat-grid"><Detail label={t.charge} value={selectedBattery?.soc === null ? t.unknown : selectedBattery?.soc + '% (reported)'}/><Detail label={t.health} value={selectedBattery?.soh === null ? t.noData : selectedBattery?.soh + '%'}/><Detail label={t.temperature} value={selectedBattery?.temperature === null ? t.noData : selectedBattery?.temperature + '°C'}/><Detail label={t.voltage} value={selectedBattery?.voltage === null ? t.noData : selectedBattery?.voltage + ' V'}/></div><div className="notice-inline"><Icon name="alert"/>{t.batteryNote}</div></div>
          <div className="surface-card battery-detail"><div className="card-head"><div><span className="eyebrow">BATTERY REGISTER</span><h3>{language==='ar'?'سجل البطاريات':'Battery assets'}</h3></div></div>{batteries.map(b=><button key={b.id} className={'battery-row '+(selectedBattery?.id===b.id?'selected':'')} onClick={()=>setSelectedBatteryId(b.id)}><div className="battery-row-icon"><Icon name="battery"/></div><div><strong>{b.id}</strong><small>{b.manufacturer} · {b.assignment}</small></div><StatusPill status={b.status} language={language}/></button>)}<div className="status-actions"><button className="btn-secondary" onClick={()=>updateBattery(selectedBattery.id,{status:'Charging'})}>{t.setCharging}</button><button className="btn-secondary" onClick={()=>updateBattery(selectedBattery.id,{status:'Available'})}>{t.setAvailable}</button><button className="btn-secondary" onClick={()=>updateBattery(selectedBattery.id,{status:'Maintenance'})}>{t.setMaintenance}</button><button className="btn-danger" onClick={()=>updateBattery(selectedBattery.id,{status:'Fault'})}>{t.setFault}</button></div><p className="muted-text">{t.localChanges}</p></div>
        </div>}
      </section>}

      {activeTab === 'faults' && <section className="page-content">
        <PageIntro eyebrow="RELIABILITY / FAILURE ANALYSIS" title={t.faults} subtitle={t.faultSub}/>
        <div className="two-column-page"><div className="surface-card"><div className="card-head"><div><span className="eyebrow">FAULT LOG</span><h3>{t.newFaults}</h3></div><span className="counter">{faults.filter(f=>f.status!=='Resolved').length}</span></div><div className="record-stack">{faults.map(f=><div className="fault-record" key={f.id}><div className="record-top"><div><span className="eyebrow">{f.id} · {f.shuttleId}</span><h3>{f.title}</h3></div><div className="record-badges"><span className={'severity severity-'+f.severity.toLowerCase()}>{f.severity}</span><StatusPill status={f.status} language={language}/></div></div><p>{f.description}</p><div className="record-meta"><span>Cause: {f.probableCauses.join(', ')}</span><span>Assigned: {f.assignedTechnician}</span></div><div className="record-meta">Procedure: {f.diagnosticProcedure}</div>{!f.correctiveAction?.trim()?<form className="action-form" onSubmit={e=>recordCorrectiveAction(e,f.id)}><textarea name="action" placeholder={t.corrective} required/><button className="btn-secondary" type="submit">{t.saveAction}</button></form>:<div className="corrective-saved"><Icon name="check" size={15}/>{f.correctiveAction}</div>}<div className="record-actions"><button className="btn-secondary" disabled={f.status!=='Open'} onClick={()=>setFaults(prev=>prev.map(x=>x.id===f.id?{...x,status:'Investigating'}:x))}>{t.investigate}</button><button className="btn-primary" disabled={!f.correctiveAction?.trim()||f.status==='Resolved'} onClick={()=>setFaults(prev=>prev.map(x=>x.id===f.id?{...x,status:'Resolved'}:x))}>{t.resolve}</button></div></div>)}{faults.length===0&&<div className="empty-state">{t.noFaults}</div>}</div></div>
          <div className="surface-card"><div className="card-head"><div><span className="eyebrow">NEW FIELD REPORT</span><h3>{t.registerFault}</h3></div></div><form className="stack-form" onSubmit={addFault}><label>Shuttle<select name="shuttleId">{shuttles.map(s=><option key={s.id} value={s.id}>{s.id} · {s.manufacturer}</option>)}</select></label><label>{t.faultTitle}<input name="title" required/></label><label>{t.severity}<select name="severity"><option>Critical</option><option>Major</option><option>Moderate</option><option>Minor</option></select></label><label>{t.description}<textarea name="description" required/></label><label>{t.probableCause}<input name="cause"/></label><label>{t.procedure}<textarea name="procedure"/></label><label>{t.technician}<input name="technician"/></label><button className="btn-primary" type="submit">{t.registerFault}</button></form></div></div>
      </section>}

      {activeTab === 'maintenance' && <section className="page-content">
        <PageIntro eyebrow="MAINTENANCE / WORK MANAGEMENT" title={t.maintenance} subtitle={t.maintenanceSub}/>
        <div className="two-column-page"><div className="surface-card"><div className="card-head"><div><span className="eyebrow">WORK ORDER QUEUE</span><h3>{t.backlog}</h3></div><span className="counter">{jobs.filter(j=>j.status!=='Completed').length}</span></div><div className="record-stack">{jobs.map(j=><div className="work-record" key={j.id}><div className="record-top"><div><span className="eyebrow">{j.id} · {j.shuttleId}</span><h3>{j.title}</h3></div><StatusPill status={j.status} language={language}/></div><div className="record-meta"><span>Type: {j.type}</span><span>Date: {j.scheduledDate}</span><span>Technician: {j.technician}</span></div><p>{j.notes}</p><div className="record-actions"><button className="btn-secondary" disabled={j.status!=='Scheduled'} onClick={()=>setJobs(prev=>prev.map(x=>x.id===j.id?{...x,status:'In Progress'}:x))}>{t.startWork}</button><button className="btn-primary" disabled={j.status==='Completed'} onClick={()=>setJobs(prev=>prev.map(x=>x.id===j.id?{...x,status:'Completed'}:x))}>{t.completeWork}</button></div></div>)}{jobs.length===0&&<div className="empty-state">{t.noWork}</div>}</div></div>
          <div className="surface-card"><div className="card-head"><div><span className="eyebrow">PLANNED SERVICE</span><h3>{t.createWork}</h3></div></div><form className="stack-form" onSubmit={addJob}><label>Shuttle<select name="shuttleId">{shuttles.map(s=><option key={s.id} value={s.id}>{s.id} · {s.manufacturer}</option>)}</select></label><label>{t.workTitle}<input name="title" required/></label><label>Type<select name="type"><option>Preventive</option><option>Corrective</option></select></label><label>{t.date}<input name="date" type="date" required/></label><label>{t.technician}<input name="technician"/></label><label>{t.notes}<textarea name="notes"/></label><button className="btn-primary" type="submit">{t.createWork}</button></form></div></div>
      </section>}

      {activeTab === 'connections' && <section className="page-content"><PageIntro eyebrow="INDUSTRIAL NETWORK / INTEGRATION" title={language==='ar'?'معمارية الاتصال بالمعدات':'Device integration architecture'} subtitle={t.connectionSub}/><div className="protocol-grid">{initialConnections.map((c,i)=><div className="surface-card protocol-card" key={c.name}><div className="protocol-icon"><Icon name="network" size={23}/></div><div className="protocol-index">0{i+1}</div><h3>{c.protocol}</h3><strong>{c.name}</strong><p>{c.notes}</p><div className="protocol-footer"><StatusPill status={c.mode} language={language}/><span>{t.notConfigured}</span></div></div>)}</div><div className="notice-inline"><Icon name="alert"/>{language==='ar'?'قبل تفعيل أي اتصال: يلزم دليل المصنع، وخريطة العناوين، وبيانات الشبكة، وتصريح فني. البداية قراءة فقط.':'Before enabling a connection: obtain vendor interface manuals, register/address maps, network details and engineering authorization. Begin read-only.'}</div></section>}

      {activeTab === 'ai' && <section className="page-content"><PageIntro eyebrow="ENGINEERING SUPPORT / DECISION ASSISTANCE" title={language==='ar'?'المساعد الفني والهندسي':'Technical engineering assistant'} subtitle={t.aiSub}/><div className="assistant-layout"><div className="surface-card assistant-main"><div className="assistant-mark"><Icon name="spark" size={28}/></div><span className="eyebrow">ENGINEERING CHECKLIST · NOT AI GENERATED</span><h2>{language==='ar'?'مسار فحص مبدئي لعربة Craftsman':'Craftsman field verification checklist'}</h2><p>{language==='ar'?'البلاغات المسجلة تشمل عدم قراءة الطبالي الخشبية، وسحب البطارية، والإنذارات الكاذبة، وانزلاق العجلات على الثلج، وفصل الحساسات والتوقف المفاجئ. لا يمكن تحديد السبب من هذه المعلومات وحدها.':'Reported observations include wooden pallet recognition problems, rapid battery drain, false alarms, wheel slip on ice, sensor cut-outs and sudden stops. These observations alone do not establish a root cause.'}</p><div className="checklist">{['Inspect sensor lenses, mounting and detection field','Verify wooden pallet detection with known-good samples','Capture battery voltage/current trend under controlled load','Inspect wheel tread, bearings and ice contamination','Review safety interlocks and event logs before return to service'].map((x,i)=><div className="check-row" key={x}><span>0{i+1}</span><p>{x}</p><StatusPill status="Unknown" language={language}/></div>)}</div><div className="notice-inline"><Icon name="alert"/> {t.modelDisclaimer}</div></div><div className="surface-card assistant-side"><div className="card-head"><div><span className="eyebrow">ASSISTANT STATUS</span><h3>AI PROVIDER</h3></div><span className="status-pill status-unknown">NOT CONNECTED</span></div><p className="muted-text">{language==='ar'?'لم يتم ربط Gemini أو أي مزود ذكاء اصطناعي. المحتوى المعروض قائمة فحص ثابتة ولا يمثل تشخيصًا آليًا.':'Gemini or another AI provider is not configured. The displayed content is a static checklist, not an automated diagnosis.'}</p><div className="assistant-info"><Detail label="Mode" value="Advisory only"/><Detail label="Source" value="Manual field reports"/><Detail label="Machine control" value="Disabled"/></div></div></div></section>}

      {activeTab === 'reports' && <section className="page-content"><PageIntro eyebrow="OPERATIONS INTELLIGENCE / EXPORTS" title={language==='ar'?'تقارير التشغيل':'Operational reports'} subtitle={t.reportsSub}/><div className="report-toolbar"><button className="btn-primary" onClick={exportCsv}>{t.exportCsv}</button><button className="btn-secondary" onClick={exportBackup}>{t.backup}</button><button className="btn-secondary" onClick={()=>window.print()}>{t.print}</button></div><div className="report-metrics"><Metric icon="truck" label={t.total} value={shuttles.length} accent="blue"/><Metric icon="alert" label={t.faulted} value={faults.filter(f=>f.status!=='Resolved').length} accent="red"/><Metric icon="wrench" label={t.backlog} value={jobs.filter(j=>j.status!=='Completed').length} accent="amber"/><Metric icon="battery" label={t.battery} value="—" accent="cyan"/></div><div className="surface-card"><div className="card-head"><div><span className="eyebrow">EXPORT PREVIEW</span><h3>{language==='ar'?'سجل العربات':'Shuttle asset register'}</h3></div><span className="status-pill status-unknown">LOCAL SNAPSHOT</span></div><div className="table-wrap"><table><thead><tr><th>ID</th><th>{t.manufacturer}</th><th>{t.model}</th><th>{t.status}</th><th>{t.communication}</th><th>{t.zone}</th></tr></thead><tbody>{shuttles.map(s=><tr key={s.id}><td>{s.id}</td><td>{s.manufacturer}</td><td>{s.model}</td><td><StatusPill status={s.status} language={language}/></td><td>{s.connectivity}</td><td>{s.warehouseZone}</td></tr>)}</tbody></table></div></div></section>}

      {activeTab === 'notifications' && <section className="page-content"><PageIntro eyebrow="EVENT CENTER / ALERTS" title={language==='ar'?'مركز الإشعارات':'Notifications center'} subtitle={language==='ar'?'تنبيهات محلية ناتجة عن السجلات اليدوية فقط.':'Local notifications from manually recorded events only.'}/><div className="surface-card empty-state"><Icon name="bell" size={34}/><h3>{t.noNotifications}</h3><p>{t.demoText}</p></div></section>}

      {activeTab === 'users' && <section className="page-content"><PageIntro eyebrow="IDENTITY / ACCESS PREVIEW" title={language==='ar'?'المستخدمون والأمان':'Users & security'} subtitle={t.roleNotice}/><div className="user-grid">{users.map(u=><button className={'surface-card user-card '+(currentUser.role===u.role?'selected':'')} key={u.id} onClick={()=>setCurrentUser(u)}><div className="avatar large">{u.name.split(' ').map(v=>v[0]).join('').slice(0,2)}</div><h3>{u.name}</h3><p>{u.role}</p><span>{u.email}</span></button>)}</div><div className="notice-inline"><Icon name="alert"/>{t.noUsers}</div></section>}

      {activeTab === 'settings' && <section className="page-content"><PageIntro eyebrow="APPLICATION / PREFERENCES" title={language==='ar'?'إعدادات النظام':'System settings'} subtitle={language==='ar'?'تخصيص العرض واللغة وتصدير بيانات التطبيق المحلية.':'Configure appearance, language and local application data exports.'}/><div className="settings-grid"><div className="surface-card"><h3>{t.language}</h3><div className="choice-row"><button className={language==='en'?'selected':''} onClick={()=>setLanguage('en')}>English</button><button className={language==='ar'?'selected':''} onClick={()=>setLanguage('ar')}>العربية</button></div></div><div className="surface-card"><h3>{t.theme}</h3><div className="choice-row"><button className={theme==='dark'?'selected':''} onClick={()=>setTheme('dark')}>{t.dark}</button><button className={theme==='light'?'selected':''} onClick={()=>setTheme('light')}>{t.light}</button></div></div><div className="surface-card"><h3>{t.role}</h3><select value={currentUser.role} onChange={e=>setCurrentUser(users.find(u=>u.role===e.target.value as Role)||users[0])}>{users.map(u=><option key={u.id} value={u.role}>{u.role}</option>)}</select><p className="muted-text">{t.roleNotice}</p></div><div className="surface-card"><h3>{language==='ar'?'نسخة احتياطية محلية':'Local backup'}</h3><p className="muted-text">{t.dataNotice}</p><button className="btn-primary" onClick={exportBackup}>{t.backup}</button></div></div></section>}

      <footer className="app-footer"><span>SHUTTLE OPS · V7 ENGINEERING UI</span><span>{t.dataNotice}</span></footer>
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
