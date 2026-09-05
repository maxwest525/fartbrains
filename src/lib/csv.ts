/** Minimal, dependency-free CSV helpers used by the dashboard exports. */

/**
 * Characters that make a spreadsheet treat a cell as a formula rather than
 * text. Excel, Sheets and LibreOffice all do this.
 *
 * This matters more here than in most exports. The vault is full of text
 * captured from other people — Instagram captions, transcripts, web page
 * bodies — so a third party can choose what ends up in a cell. Put
 * `=HYPERLINK(...)` or `=cmd|'/c calc'!A0` in a caption, wait for it to be
 * captured, and it runs when the owner opens their own export.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** `-5` and `+3.1` are data, not formulas, and must not be mangled. */
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

const escapeCell = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  let text = typeof value === "string" ? value : String(value);

  // Neutralize the formula lead with an apostrophe, which spreadsheets strip
  // on display and treat as "this is text". Done before quoting so the
  // apostrophe ends up inside the quotes where it belongs.
  if (FORMULA_LEAD.test(text) && !PLAIN_NUMBER.test(text)) {
    text = `'${text}`;
  }

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
  return `﻿${lines.join("\r\n")}`;
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
