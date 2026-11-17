/**
 * Spreadsheet-safe cell handling shared by CSV and XLSX exports.
 *
 * Formula-like strings are prefixed with an apostrophe. Spreadsheet programs
 * treat the resulting value as text rather than evaluating it as a formula.
 * Numbers and booleans remain typed and unchanged.
 */
export type SpreadsheetCellValue = string | number | boolean | null | undefined;

const FORMULA_PREFIX = /^[=+\-@\t\r]/u;

export function sanitizeSpreadsheetCell(value: SpreadsheetCellValue): SpreadsheetCellValue {
  if (typeof value !== 'string') return value;
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}
