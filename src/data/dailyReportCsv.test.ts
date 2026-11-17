import { describe, expect, it } from 'vitest';
import { buildDailyReportCsv, buildDailyReportCsvRows } from './dailyReportCsv';
import type { DailyReportSnapshot } from '../types';

const report: DailyReportSnapshot = {
  id: 'RPT-1',
  reportDate: '2026-11-17',
  generatedAt: '2026-11-17T10:00:00.000Z',
  shuttleCount: 1,
  runningCount: 1,
  readyCount: 0,
  disconnectedCount: 1,
  openFaultCount: 0,
  openMaintenanceCount: 0,
  batteryCount: 1,
  faultedBatteryCount: 0,
  verifiedTelemetryCount: 0,
  shuttles: [],
  batteries: [{
    id: 'BAT-001',
    manufacturer: 'Cassioli',
    status: 'Available',
    assignment: 'Unassigned',
    soc: null,
    connectionMode: 'UNKNOWN',
    movementHistory: [{
      id: 'MOV-1',
      timestamp: '2026-11-17T09:30:00.000Z',
      action: 'Removed',
      fromShuttleId: 'SC-01',
      toShuttleId: 'Unassigned',
      note: 'Removed for inspection',
      source: 'MANUAL'
    }]
  }]
};

describe('daily report CSV formatting', () => {
  it('keeps battery movement data aligned with all seven journal columns', () => {
    const rows = buildDailyReportCsvRows(report);
    const headerIndex = rows.findIndex(row => row[0] === 'BATTERY MOVEMENT JOURNAL');

    expect(headerIndex).toBeGreaterThanOrEqual(0);
    expect(rows[headerIndex]).toHaveLength(7);
    expect(rows[headerIndex + 1]).toEqual([
      '', 'BAT-001', '2026-11-17T09:30:00.000Z', 'Removed',
      'SC-01', 'Unassigned', 'Removed for inspection'
    ]);
    expect(rows[headerIndex + 1]).toHaveLength(rows[headerIndex].length);
  });

  it('escapes CSV quotes and preserves the movement journal values', () => {
    const csv = buildDailyReportCsv({
      ...report,
      batteries: [{
        ...report.batteries[0],
        movementHistory: [{
          ...report.batteries[0].movementHistory![0],
          note: 'Inspection said "replace wheel"'
        }]
      }]
    });

    expect(csv).toContain('"","BAT-001","2026-11-17T09:30:00.000Z","Removed","SC-01","Unassigned","Inspection said ""replace wheel"""');
  });
});
