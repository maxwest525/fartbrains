import { describe, expect, it } from "vitest";
import { csvFilename, toCsv } from "../csv";

const one = (value: unknown) =>
  toCsv([{ v: value }], [{ header: "V", value: (r: { v: unknown }) => r.v }])
    .replace("\uFEFF", "")
    .split("\r\n")[1];

describe("escaping", () => {
  it("leaves plain text alone", () => {
    expect(one("hello")).toBe("hello");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(one("a,b")).toBe('"a,b"');
    expect(one('say "hi"')).toBe('"say ""hi"""');
    expect(one("line1\nline2")).toBe('"line1\nline2"');
  });

  it("writes an empty cell for null and undefined", () => {
    expect(one(null)).toBe("");
    expect(one(undefined)).toBe("");
  });
});

/**
 * The vault holds text other people wrote — captions, transcripts, page
 * bodies — so an attacker can choose the contents of a cell and wait for the
 * owner to open their own export.
 */
describe("formula injection", () => {
  it("neutralizes a leading = so it is not executed on open", () => {
    // No comma, quote or newline in it, so it needs no quoting — just the
    // apostrophe that stops the spreadsheet executing it.
    expect(one("=cmd|'/c calc'!A0")).toBe("'=cmd|'/c calc'!A0");
  });

  it("neutralizes the other formula leads", () => {
    expect(one("+1+1")).toBe("'+1+1");
    expect(one("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(one("-2+3")).toBe("'-2+3");
  });

  it("neutralizes a HYPERLINK, the quiet one people actually click", () => {
    expect(one('=HYPERLINK("http://evil","Invoice")')).toBe(
      `"'=HYPERLINK(""http://evil"",""Invoice"")"`,
    );
  });

  it("neutralizes leading tab and carriage return", () => {
    // Tab is legal unquoted in CSV, so only the apostrophe is added.
    expect(one("\t=1+1")).toBe("'\t=1+1");
  });

  it("does not mangle a negative number, which is data", () => {
    expect(one("-5")).toBe("-5");
    expect(one("-1.5")).toBe("-1.5");
    expect(one("+3")).toBe("+3");
  });

  it("escapes a dangerous header too", () => {
    const csv = toCsv([], [{ header: "=1+1", value: () => "" }]).replace("\uFEFF", "");
    expect(csv.split("\r\n")[0]).toBe("'=1+1");
  });

  it("keeps the apostrophe inside the quotes when the cell also needs quoting", () => {
    // "'=a,b" and not "'"=a,b"" — otherwise the row shifts by a column.
    expect(one("=a,b")).toBe(`"'=a,b"`);
  });
});

describe("shape", () => {
  it("starts with a BOM and separates rows with CRLF", () => {
    const csv = toCsv([{ a: "1" }], [{ header: "A", value: (r: { a: string }) => r.a }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toBe("\uFEFFA\r\n1");
  });

  it("names the file with today's date", () => {
    expect(csvFilename("ideas")).toMatch(/^fartbrains-ideas-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
