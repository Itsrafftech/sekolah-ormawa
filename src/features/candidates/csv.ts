// Mitigates CSV/formula injection (Excel/Sheets execute cells starting
// with these characters as formulas when the file is opened).
export function escapeCsvCell(value: string): string {
  const needsFormulaGuard = /^[=+\-@]/u.test(value);
  const guarded = needsFormulaGuard ? `'${value}` : value;
  if (/[",\n\r]/u.test(guarded)) {
    return `"${guarded.replace(/"/gu, '""')}"`;
  }
  return guarded;
}

export function toCsvRow(values: string[]): string {
  return values.map(escapeCsvCell).join(",");
}
