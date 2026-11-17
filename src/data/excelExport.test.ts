import { describe, expect, it } from 'vitest';
import { initialBatteries, initialFaults, initialShuttles, initialMaintenance } from './mockData';
import { buildDailyReportSheets, buildRegisterSheets, createXlsxBuffer } from './excelExport';
import type { DailyReportSnapshot } from '../types';

describe('multi-sheet Excel export', () => {
  it('creates a valid XLSX workbook with all operational registers', async () => {
    const sheets = buildRegisterSheets({
      shuttles: initialShuttles,
      batteries: initialBatteries,
      faults: initialFaults,
      jobs: initialMaintenance,
      shifts: [],
      dailyReports: [],
      notifications: [],
      connections: [{
        name: 'Approved gateway register',
        protocol: 'OPC UA',
        mode: 'UNKNOWN',
        notes: 'Local placeholder only'
      }]
    }, 'en');
    for (const sheet of sheets) {
      const columnCount = Math.max(0, ...sheet.rows.map(row => row.length));
      expect(sheet.widths?.length ?? columnCount).toBeGreaterThanOrEqual(columnCount);
    }
    const bytes = await createXlsxBuffer(sheets);
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(bytes, { type: 'array' });
    expect(workbook.SheetNames).toEqual([
      'Shuttles','Batteries','Battery movements','Faults','Maintenance','Connections','Shift handovers','Daily report history','Notifications'
    ]);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Shuttles, { header: 1 }) as unknown[][];
    expect(rows[1]).toContain('SC-01');
    expect(rows[1]).toContain('Cassioli');
  });

  it('includes recorded maintenance completion results in the workbook', async () => {
    const sheets = buildRegisterSheets({
      shuttles: initialShuttles,
      batteries: initialBatteries,
      faults: initialFaults,
      jobs: [{
        id: 'MNT-DONE',
        shuttleId: 'SC-01',
        title: 'Drive inspection',
        type: 'Preventive',
        status: 'Completed',
        scheduledDate: '2026-11-20',
        technician: 'Technician A',
        notes: 'Planned inspection',
        completionNotes: 'Inspected gearbox mount and recorded torque verification.'
      }],
      shifts: [],
      dailyReports: [],
      notifications: [],
      connections: []
    }, 'en');
    const maintenance = sheets.find(sheet => sheet.name === 'Maintenance');
    expect(maintenance?.rows[1]).toContain('Inspected gearbox mount and recorded torque verification.');
  });

  it('exports a daily snapshot with its active shift and battery movements', async () => {
    const report: DailyReportSnapshot = {
      id: 'RPT-1', reportDate: '2026-11-17', generatedAt: '2026-11-17T09:00:00.000Z',
      shuttleCount: 1, runningCount: 1, readyCount: 0, disconnectedCount: 0, openFaultCount: 1,
      openMaintenanceCount: 0, batteryCount: 1, faultedBatteryCount: 0, verifiedTelemetryCount: 0,
      activeShift: { id: 'SHF-1', shiftType: 'Day', supervisor: 'Supervisor A', startedAt: '2026-11-17T08:00:00.000Z' },
      shuttles: [{ id: 'SC-01', manufacturer: 'Cassioli', status: 'Running', connectivity: 'UNKNOWN', warehouseZone: 'A1' }],
      batteries: [{
        id: 'BAT-01', manufacturer: 'Cassioli', status: 'Installed', assignment: 'SC-01', soc: 80, connectionMode: 'UNKNOWN',
        movementHistory: [{ id: 'MOVE-1', timestamp: '2026-11-17T08:30:00.000Z', action: 'Assigned', fromShuttleId: 'Unassigned', toShuttleId: 'SC-01', note: 'Manual local record', source: 'MANUAL' }]
      }]
    };
    const sheets = buildDailyReportSheets(report, 'ar');
    const buffer = await createXlsxBuffer(sheets);
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });
    const summary = XLSX.utils.sheet_to_json(workbook.Sheets.Summary, { header: 1 }) as unknown[][];
    const movementRows = XLSX.utils.sheet_to_json(workbook.Sheets['Battery movements'], { header: 1 }) as unknown[][];
    expect(summary.some(row => row.includes('SHF-1'))).toBe(true);
    expect(movementRows.some(row => row.includes('BAT-01') && row.includes('Assigned'))).toBe(true);
  });

  it('writes formula-like XLSX cell values as quoted text', async () => {
    const unsafeShuttle = { ...initialShuttles[0], notes: '=HYPERLINK("https://example.invalid","open")' };
    const sheets = buildRegisterSheets({
      shuttles: [unsafeShuttle],
      batteries: [],
      faults: [],
      jobs: [],
      shifts: [],
      dailyReports: [],
      notifications: [],
      connections: []
    }, 'en');
    const buffer = await createXlsxBuffer(sheets);
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });
    const notesCell = workbook.Sheets.Shuttles.P2;

    expect(notesCell.v).toBe(`'=HYPERLINK("https://example.invalid","open")`);
    expect(notesCell.f).toBeUndefined();
  });
});
