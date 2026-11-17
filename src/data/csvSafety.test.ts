import { describe, expect, it } from 'vitest';
import { sanitizeSpreadsheetCell } from './csvSafety';

describe('spreadsheet formula-injection protection', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])('prefixes strings beginning with %s', prefix => {
    const value = `${prefix}1+1`;
    expect(sanitizeSpreadsheetCell(value)).toBe(`'${value}`);
  });

  it('preserves ordinary strings and empty strings', () => {
    expect(sanitizeSpreadsheetCell('Cassioli SC-01')).toBe('Cassioli SC-01');
    expect(sanitizeSpreadsheetCell('')).toBe('');
  });

  it('preserves numeric, boolean and nullish cell types unchanged', () => {
    expect(sanitizeSpreadsheetCell(0)).toBe(0);
    expect(sanitizeSpreadsheetCell(-12)).toBe(-12);
    expect(sanitizeSpreadsheetCell(4.5)).toBe(4.5);
    expect(sanitizeSpreadsheetCell(true)).toBe(true);
    expect(sanitizeSpreadsheetCell(false)).toBe(false);
    expect(sanitizeSpreadsheetCell(null)).toBe(null);
    expect(sanitizeSpreadsheetCell(undefined)).toBe(undefined);
  });
});
