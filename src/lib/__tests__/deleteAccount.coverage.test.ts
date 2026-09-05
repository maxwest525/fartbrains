import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * "Delete my account" has to mean it.
 *
 * `delete-account` removes rows table by table rather than leaning on
 * ON DELETE CASCADE, precisely so a missing cascade cannot leave someone's
 * private rows behind after they asked for them to be gone. That reasoning
 * only holds while the list is complete — and a list maintained by hand
 * silently falls behind every migration that adds a table.
 *
 * So the owned set is derived from the migrations instead. A new user-owned
 * table fails this test until it is either deleted or deliberately excluded
 * with a reason, which is the decision someone should be making anyway.
 */
const MIGRATIONS = resolve(__dirname, "../../../supabase/migrations");
const FUNCTION = resolve(__dirname, "../../../supabase/functions/delete-account/index.ts");

/**
 * Kept on purpose after an account is deleted.
 *
 * `billing_events` is a financial audit log whose `user_id` is
 * ON DELETE SET NULL: the row survives with the person detached from it, which
 * is what a payment record has to do. It holds a Stripe event id, a type and a
 * status — no vault content.
 */
const DELIBERATELY_KEPT = new Set(["billing_events"]);

/** Tables declaring a user_id or an auth.users reference, from the schema itself. */
const ownedTablesFromMigrations = (): Set<string> => {
  const owned = new Set<string>();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(resolve(MIGRATIONS, file), "utf8");
    // Split on CREATE TABLE so each chunk is one table's column list.
    const chunks = sql.split(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?public\./i).slice(1);
    for (const chunk of chunks) {
      const name = chunk.match(/^([a-z_]+)/i)?.[1];
      if (!name) continue;
      const columns = chunk.slice(0, chunk.indexOf("\n);"));
      if (/\buser_id\b/.test(columns) || /REFERENCES auth\.users/.test(columns)) {
        owned.add(name);
      }
    }
  }
  return owned;
};

const deletedTables = (): string[] => {
  const src = readFileSync(FUNCTION, "utf8");
  const block = src.match(/OWNED_TABLES = \[([\s\S]*?)\] as const;/);
  if (!block) throw new Error("OWNED_TABLES not found in delete-account");
  return [...block[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
};

describe("account deletion covers every table that holds a customer's rows", () => {
  const owned = ownedTablesFromMigrations();
  const deleted = new Set(deletedTables());

  it("found the schema and the list", () => {
    expect(owned.size).toBeGreaterThan(10);
    expect(deleted.size).toBeGreaterThan(10);
  });

  it("leaves nothing behind", () => {
    const missed = [...owned].filter((t) => !deleted.has(t) && !DELIBERATELY_KEPT.has(t));
    expect(missed).toEqual([]);
  });

  it("does not list a table that no migration creates", () => {
    // A typo here fails silently at runtime: the delete matches nothing and the
    // "does not exist" branch swallows the error.
    const phantom = [...deleted].filter((t) => !owned.has(t) && t !== "profiles");
    expect(phantom).toEqual([]);
  });

  it("deletes dependents before the rows they point at", () => {
    const order = deletedTables();
    const before = (a: string, b: string) => order.indexOf(a) < order.indexOf(b);
    expect(before("source_chunks", "source_versions")).toBe(true);
    expect(before("evidence_spans", "source_versions")).toBe(true);
    expect(before("source_versions", "sources")).toBe(true);
    expect(before("idea_shares", "ideas")).toBe(true);
    expect(before("idea_references", "ideas")).toBe(true);
    expect(before("idea_chats", "ideas")).toBe(true);
    expect(before("idea_reminders", "ideas")).toBe(true);
    expect(before("event_gifts", "calendar_events")).toBe(true);
    expect(before("ideas", "folders")).toBe(true);
    expect(before("sources", "projects")).toBe(true);
  });

  it("still requires a recent login and a typed confirmation", () => {
    const src = readFileSync(FUNCTION, "utf8");
    expect(src).toContain("reauth_required");
    expect(src).toMatch(/confirm\?: unknown \}\)\.confirm !== "DELETE"/);
  });

  it("treats a table missing from this environment as skipped, not failed", () => {
    // Several of these ship in migrations that may not be applied yet; without
    // this branch, deletion would report a partial failure and remove nothing.
    expect(readFileSync(FUNCTION, "utf8")).toMatch(/does not exist/i);
  });
});
