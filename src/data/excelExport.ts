import type {
  Battery, DailyReportSnapshot, Fault, Language, MaintenanceJob, NotificationItem, ShiftRecord, Shuttle
} from '../types';

export type ExcelCell = string | number | boolean | null | undefined;

export interface WorkbookSheetData {
  name: string;
  rows: ExcelCell[][];
  widths?: number[];
}

function header(language: Language, en: string, ar: string): string {
  return language === 'ar' ? ar : en;
}

export function buildRegisterSheets(data: {
  shuttles: Shuttle[];
  batteries: Battery[];
  faults: Fault[];
  jobs: MaintenanceJob[];
  shifts: ShiftRecord[];
  dailyReports: DailyReportSnapshot[];
  notifications: NotificationItem[];
}, language: Language): WorkbookSheetData[] {
  const h = (en: string, ar: string) => header(language, en, ar);
  const shuttles: ExcelCell[][] = [
    ['ID', h('Manufacturer','الشركة المصنعة'), h('Model','الموديل'), h('Serial number','الرقم المسلسل'),
      h('Hardware','إصدار العتاد'), h('Firmware','إصدار البرنامج'), h('Zone','المنطقة'),
      h('Status','الحالة'), h('Connectivity','الاتصال'), h('Installed battery','البطارية المركبة'),
      h('Operating hours','ساعات التشغيل'), h('Operating cycles','دورات التشغيل'),
      h('Operator','المشغل'), h('Last communication','آخر اتصال'), h('Archived at','تاريخ الأرشفة'), h('Notes','ملاحظات')],
    ...data.shuttles.map(item => [item.id,item.manufacturer,item.model,item.serialNumber,item.hardwareVersion,item.firmwareVersion,item.warehouseZone,
      item.status,item.connectivity,item.installedBattery,item.operatingHours,item.operatingCycles,item.assignedOperator,item.lastCommunication,item.archivedAt || '',item.notes])
  ];
  const batteries: ExcelCell[][] = [
    ['ID',h('Manufacturer','الشركة المصنعة'),h('Model','الموديل'),h('Chemistry','الكيمياء'),h('Nominal voltage','الجهد الاسمي'),
      h('Capacity','السعة'), 'SOC %','SOH %',h('Temperature °C','الحرارة °C'),h('Voltage V','الجهد V'),h('Current A','التيار A'),
      h('Cycles','الدورات'),h('Status','الحالة'),h('Assignment','التخصيص'),h('Connection mode','مصدر البيانات'),h('Archived at','تاريخ الأرشفة')],
    ...data.batteries.map(item => [item.id,item.manufacturer,item.model,item.chemistry,item.nominalVoltage,item.capacity,item.soc,item.soh,item.temperature,
      item.voltage,item.current,item.cycles,item.status,item.assignment,item.connectionMode,item.archivedAt || ''])
  ];
  const movements: ExcelCell[][] = [
    [h('Battery ID','رقم البطارية'),h('Timestamp','التاريخ والوقت'),h('Action','الحركة'),h('From shuttle','من جهاز'),h('To shuttle','إلى جهاز'),h('Note','ملاحظة'),h('Source','المصدر')],
    ...data.batteries.flatMap(item => (item.movementHistory || []).map(move => [item.id,move.timestamp,move.action,move.fromShuttleId,move.toShuttleId,move.note,move.source]))
  ];
  const faults: ExcelCell[][] = [
    ['ID',h('Shuttle','الشاتل'),h('Title','العنوان'),h('Severity','الخطورة'),h('Status','الحالة'),h('Reported at','وقت البلاغ'),
      h('Description','الوصف'),h('Possible causes','أسباب محتملة'),h('Procedure','إجراء الفحص'),h('Corrective action','الإجراء التصحيحي'),h('Technician','الفني')],
    ...data.faults.map(item => [item.id,item.shuttleId,item.title,item.severity,item.status,item.timestamp,item.description,item.probableCauses.join(' | '),
      item.diagnosticProcedure,item.correctiveAction || '',item.assignedTechnician])
  ];
  const maintenance: ExcelCell[][] = [
    ['ID',h('Shuttle','الشاتل'),h('Work order','أمر العمل'),h('Type','النوع'),h('Status','الحالة'),h('Scheduled date','التاريخ المجدول'),h('Technician','الفني'),h('Notes','ملاحظات')],
    ...data.jobs.map(item => [item.id,item.shuttleId,item.title,item.type,item.status,item.scheduledDate,item.technician,item.notes])
  ];
  const shifts: ExcelCell[][] = [
    ['ID',h('Shift','الوردية'),h('Started at','وقت البداية'),h('Ended at','وقت النهاية'),h('Supervisor','المشرف'),h('Operators','المشغلون'),
      h('Opening faults','أعطال بداية الوردية'),h('Closing faults','أعطال نهاية الوردية'),h('Opening work orders','صيانة بداية الوردية'),
      h('Closing work orders','صيانة نهاية الوردية'),h('Opening notes','ملاحظات البداية'),h('Handover notes','ملاحظات التسليم')],
    ...data.shifts.map(item => [item.id,item.shiftType,item.startedAt,item.endedAt || '',item.supervisor,item.operators,item.openingOpenFaults,
      item.closingOpenFaults,item.openingOpenMaintenance,item.closingOpenMaintenance,item.openingNotes,item.handoverNotes])
  ];
  const reportHistory: ExcelCell[][] = [
    ['ID',h('Report date','تاريخ التقرير'),h('Generated at','وقت الإصدار'),h('Shuttles','الشاتلات'),h('Running','تعمل'),h('Ready','جاهزة'),
      h('Disconnected / unverified','غير متصلة / غير مؤكدة'),h('Open faults','أعطال مفتوحة'),h('Open maintenance','صيانة مفتوحة'),
      h('Batteries','البطاريات'),h('Faulted batteries','بطاريات معطلة'),h('Verified telemetry','مصادر بيانات مؤكدة'),h('Active shift','الوردية الحالية')],
    ...data.dailyReports.map(item => [item.id,item.reportDate,item.generatedAt,item.shuttleCount,item.runningCount,item.readyCount,item.disconnectedCount,
      item.openFaultCount,item.openMaintenanceCount,item.batteryCount,item.faultedBatteryCount,item.verifiedTelemetryCount,item.activeShift?.id || ''])
  ];
  const notifications: ExcelCell[][] = [
    ['ID',h('Title','العنوان'),h('Detail','التفاصيل'),h('Severity','الأهمية'),h('Time','الوقت')],
    ...data.notifications.map(item => [item.id,item.title,item.detail,item.severity,item.time])
  ];
  return [
    { name: 'Shuttles', rows: shuttles, widths: [14,18,20,20,15,15,16,16,16,20,16,16,20,24,22,42] },
    { name: 'Batteries', rows: batteries, widths: [16,18,18,16,16,14,12,12,16,14,14,12,16,18,18,22] },
    { name: 'Battery movements', rows: movements, widths: [18,24,16,18,18,52,14] },
    { name: 'Faults', rows: faults, widths: [18,16,28,14,16,24,48,42,42,42,22] },
    { name: 'Maintenance', rows: maintenance, widths: [18,16,28,16,16,18,22,42] },
    { name: 'Shift handovers', rows: shifts, widths: [24,14,24,24,24,32,18,18,20,20,42,52] },
    { name: 'Daily report history', rows: reportHistory, widths: [20,16,24,12,12,12,24,16,18,14,20,20,24] },
    { name: 'Notifications', rows: notifications, widths: [24,28,55,14,24] }
  ];
}

export function buildDailyReportSheets(report: DailyReportSnapshot, language: Language): WorkbookSheetData[] {
  const h = (en: string, ar: string) => header(language, en, ar);
  return [
    { name: 'Summary', rows: [
      [h('Metric','المؤشر'),h('Value','القيمة')],
      [h('Report ID','رقم التقرير'),report.id],
      [h('Report date','تاريخ التقرير'),report.reportDate],
      [h('Generated at','وقت الإصدار'),report.generatedAt],
      [h('Active shuttles','الشاتلات النشطة'),report.shuttleCount],
      [h('Running','تعمل'),report.runningCount],
      [h('Ready','جاهزة'),report.readyCount],
      [h('Disconnected / unverified','غير متصلة / غير مؤكدة'),report.disconnectedCount],
      [h('Open faults','أعطال مفتوحة'),report.openFaultCount],
      [h('Open maintenance','أوامر صيانة مفتوحة'),report.openMaintenanceCount],
      [h('Active batteries','بطاريات نشطة'),report.batteryCount],
      [h('Faulted batteries','بطاريات بها عطل'),report.faultedBatteryCount],
      [h('Verified telemetry sources','مصادر بيانات مؤكدة'),report.verifiedTelemetryCount],
      [h('Active shift','الوردية الحالية'),report.activeShift?.id || h('No active shift','لا توجد وردية مفتوحة')],
      [h('Shift supervisor','مشرف الوردية'),report.activeShift?.supervisor || '']
    ], widths: [34,44] },
    { name: 'Shuttles', rows: [
      ['ID',h('Manufacturer','الشركة'),h('Status','الحالة'),h('Connectivity','الاتصال'),h('Zone','المنطقة')],
      ...report.shuttles.map(item => [item.id,item.manufacturer,item.status,item.connectivity,item.warehouseZone])
    ], widths: [18,22,18,20,22] },
    { name: 'Batteries', rows: [
      ['ID',h('Manufacturer','الشركة'),h('Status','الحالة'),h('Assignment','التخصيص'),'SOC %',h('Connection','مصدر البيانات')],
      ...report.batteries.map(item => [item.id,item.manufacturer,item.status,item.assignment,item.soc,item.connectionMode])
    ], widths: [18,22,18,18,12,20] },
    { name: 'Battery movements', rows: [
      [h('Battery ID','رقم البطارية'),h('Timestamp','التاريخ والوقت'),h('Action','الحركة'),h('From shuttle','من شاتل'),h('To shuttle','إلى شاتل'),h('Note','ملاحظة')],
      ...report.batteries.flatMap(item => (item.movementHistory || []).map(move => [item.id,move.timestamp,move.action,move.fromShuttleId,move.toShuttleId,move.note]))
    ], widths: [18,24,16,18,18,52] }
  ];
}

export async function createXlsxBuffer(sheets: WorkbookSheetData[]): Promise<ArrayBuffer> {
  if (!sheets.length) throw new Error('At least one worksheet is required.');
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();
  workbook.Props = {
    Title: 'Shuttle Operations Report',
    Subject: 'Shuttle fleet, battery lifecycle, faults, maintenance and shift handovers',
    Author: 'Shuttle Operations',
    CreatedDate: new Date()
  };
  const names = new Set<string>();
  for (const sheet of sheets) {
    const safeName = sheet.name.slice(0, 31);
    if (!safeName || names.has(safeName)) throw new Error('Worksheet names must be unique and non-empty.');
    names.add(safeName);
    const worksheet = XLSX.utils.aoa_to_sheet(sheet.rows);
    if (sheet.widths) worksheet['!cols'] = sheet.widths.map(width => ({ wch: width }));
    if (sheet.rows.length) {
      const lastColumn = Math.max(0, ...sheet.rows.map(row => row.length)) - 1;
      if (lastColumn >= 0) worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sheet.rows.length - 1, c: lastColumn } }) };
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  }
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array', compression: true }) as ArrayBuffer;
}

export async function downloadXlsx(sheets: WorkbookSheetData[], fileName: string): Promise<void> {
  const buffer = await createXlsxBuffer(sheets);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.toLowerCase().endsWith('.xlsx') ? fileName : fileName + '.xlsx';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
