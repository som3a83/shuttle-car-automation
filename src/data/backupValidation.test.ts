import { describe, expect, it } from 'vitest';
import { initialBatteries, initialFaults, initialShuttles } from './mockData';
import { validateOperationalBackup } from './backupValidation';

const validBackup = () => ({
  schemaVersion: 11,
  exportedAt: '2026-11-17T00:00:00.000Z',
  shuttles: JSON.parse(JSON.stringify(initialShuttles)),
  batteries: JSON.parse(JSON.stringify(initialBatteries)),
  faults: JSON.parse(JSON.stringify(initialFaults)),
  jobs: [],
  notifications: [],
  dailyReports: [],
  shifts: []
});

describe('operational backup validation', () => {
  it('accepts valid local registers and preserves an explicitly entered zero SOC', () => {
    const backup = validBackup();
    backup.batteries[0].soc = 0;
    const result = validateOperationalBackup(backup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.batteries[0].soc).toBe(0);
    expect(result.data.batteries[0].connectionMode).toBe('UNKNOWN');
  });

  it('rejects missing required registers before state is changed', () => {
    const result = validateOperationalBackup({ shuttles: [], batteries: [], faults: [] });
    expect(result).toMatchObject({ ok: false });
  });

  it('rejects duplicate identifiers and malformed shuttle states', () => {
    const duplicate = validBackup();
    duplicate.shuttles.push({ ...duplicate.shuttles[0] });
    expect(validateOperationalBackup(duplicate)).toMatchObject({ ok: false, error: expect.stringMatching(/Duplicate/) });

    const invalid = validBackup();
    (invalid.shuttles[0] as unknown as { status: string }).status = 'MOVING';
    expect(validateOperationalBackup(invalid)).toMatchObject({ ok: false });
  });

  it('rejects malformed optional collections and invalid settings', () => {
    expect(validateOperationalBackup({ ...validBackup(), notifications: [{ id: 'bad' }] })).toMatchObject({ ok: false });
    expect(validateOperationalBackup({ ...validBackup(), settings: { theme: 'ultraviolet' } })).toMatchObject({ ok: false });
  });

  it('rejects battery assignments to missing or archived shuttles', () => {
    const orphan = validBackup();
    orphan.batteries[0].assignment = 'SC-99';
    expect(validateOperationalBackup(orphan)).toMatchObject({ ok: false, error: expect.stringMatching(/missing or archived shuttle/) });

    const archivedTarget = validBackup();
    (archivedTarget.shuttles as Array<{ id: string; archivedAt?: string | null }>)
      .find((item) => item.id === 'SC-05')!.archivedAt = '2026-11-17T08:00:00.000Z';
    expect(validateOperationalBackup(archivedTarget)).toMatchObject({ ok: false, error: expect.stringMatching(/missing or archived shuttle/) });
  });

  it('rejects multiple batteries assigned to one shuttle and unknown fault references', () => {
    const duplicate = validBackup();
    duplicate.batteries.push({ ...duplicate.batteries[0], id: 'BAT-SECOND' });
    expect(validateOperationalBackup(duplicate)).toMatchObject({ ok: false, error: expect.stringMatching(/More than one battery/) });

    const orphanFault = validBackup();
    orphanFault.faults[0].shuttleId = 'SC-99';
    expect(validateOperationalBackup(orphanFault)).toMatchObject({ ok: false, error: expect.stringMatching(/unknown shuttle/) });
  });

  it('validates connection register records and rejects a false REAL connection claim', () => {
    const valid = {
      ...validBackup(),
      connections: [{
        name: 'Cassioli read-only gateway',
        protocol: 'Modbus TCP',
        mode: 'UNKNOWN',
        notes: 'Vendor approval and address map not yet supplied.'
      }]
    };
    expect(validateOperationalBackup(valid).ok).toBe(true);

    const falseLive = {
      ...valid,
      connections: [{ ...valid.connections[0], mode: 'REAL' }]
    };
    expect(validateOperationalBackup(falseLive)).toMatchObject({ ok: false });

    const duplicateNames = {
      ...valid,
      connections: [valid.connections[0], { ...valid.connections[0], protocol: 'OPC UA' }]
    };
    expect(validateOperationalBackup(duplicateNames)).toMatchObject({ ok: false, error: expect.stringMatching(/Duplicate connection endpoint names/) });
  });

  it('migrates schema 10 backups without a connection register to an empty register', () => {
    const legacy = { ...validBackup(), schemaVersion: 10 };
    const result = validateOperationalBackup(legacy);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.connections).toEqual([]);
  });

  it('accepts earlier backups with optional collections omitted', () => {
    const old = validBackup() as Record<string, unknown>;
    delete old.notifications;
    delete old.dailyReports;
    delete old.shifts;
    const result = validateOperationalBackup(old);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.notifications).toEqual([]);
      expect(result.data.dailyReports).toEqual([]);
      expect(result.data.shifts).toEqual([]);
    }
  });
});
