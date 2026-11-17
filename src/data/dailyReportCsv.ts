import type { DailyReportSnapshot } from '../types';
import { sanitizeSpreadsheetCell } from './csvSafety';

export type DailyReportCsvRow = Array<string | number>;

export function buildDailyReportCsvRows(report: DailyReportSnapshot): DailyReportCsvRow[] {
  return [
    ['SHUTTLE CAR AUTOMATION · DAILY DEVICE STATUS', report.reportDate],
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
    ['Active shift', report.activeShift ? report.activeShift.id : 'No active shift'],
    ['Shift supervisor', report.activeShift?.supervisor || 'Not recorded'],
    ['Shift type', report.activeShift?.shiftType || 'Not recorded'],
    [],
    ['SHUTTLES', 'Manufacturer', 'Status', 'Connectivity', 'Zone'],
    ...report.shuttles.map(item => [item.id, item.manufacturer, item.status, item.connectivity, item.warehouseZone]),
    [],
    ['BATTERIES', 'Manufacturer', 'Status', 'Assignment', 'SOC', 'Connection'],
    ...report.batteries.map(item => [item.id, item.manufacturer, item.status, item.assignment, item.soc === null ? 'Not verified' : item.soc + '%', item.connectionMode]),
    [],
    ['BATTERY MOVEMENT JOURNAL', 'Battery ID', 'Timestamp', 'Action', 'From shuttle', 'To shuttle', 'Note'],
    ...report.batteries.flatMap(item => (item.movementHistory || []).map(move => [
      '', item.id, move.timestamp, move.action, move.fromShuttleId, move.toShuttleId, move.note
    ]))
  ];
}

export function buildDailyReportCsv(report: DailyReportSnapshot): string {
  return buildDailyReportCsvRows(report)
    .map(row => row.map(value => {
      const safeValue = sanitizeSpreadsheetCell(value);
      return '"' + String(safeValue ?? '').replace(/"/g, '""') + '"';
    }).join(','))
    .join('\r\n');
}
