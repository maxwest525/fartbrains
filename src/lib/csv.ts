/** Minimal, dependency-free CSV helpers used by the dashboard exports. */

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  // Quote when the cell contains a delimiter, quote or newline; double inner quotes.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export type CsvColumn<T> = { header: string; value: (row: T) => unknown };

export const toCsv = <T,>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string => {
  const lines = [columns.map((c) => escapeCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(","));
  }
  // Leading BOM keeps Excel happy with UTF-8 content.
  return `\uFEFF${lines.join("\r\n")}`;
};

export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** `fartbrains-todos-2026-09-04.csv` */
export const csvFilename = (name: string): string =>
  `fartbrains-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
