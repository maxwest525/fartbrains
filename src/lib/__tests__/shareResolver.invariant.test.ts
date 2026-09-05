import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `resolve_idea_share` is the only unauthenticated read path in the product:
 * anyone holding a link reaches it without an account. Everything it must
 * refuse is expressed in SQL, which no other test in this repo can execute —
 * there is no database in CI — so these assert on the shipped definition.
 *
 * The last migration that defines the function is the one that runs, so the
 * body is taken from there rather than from whichever file mentions it first.
 */
const MIGRATIONS = resolve(__dirname, "../../../supabase/migrations");
const SIGNATURE = "CREATE OR REPLACE FUNCTION public.resolve_idea_share";

const currentDefinition = (): string => {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // timestamp-prefixed, so lexical order is apply order
  let body = "";
  for (const f of files) {
    const sql = readFileSync(resolve(MIGRATIONS, f), "utf8");
    const at = sql.indexOf(SIGNATURE);
    if (at === -1) continue;
    const end = sql.indexOf("\n$$;", at);
    body = sql.slice(at, end === -1 ? undefined : end);
  }
  return body;
};

describe("the public share resolver", () => {
  const body = currentDefinition();

  it("is defined at all", () => {
    expect(body).toContain("RETURNS TABLE");
  });

  it("refuses a revoked share", () => {
    expect(body).toMatch(/revoked_at IS NOT NULL/);
  });

  it("refuses an expired share", () => {
    expect(body).toMatch(/expires_at IS NOT NULL AND s\.expires_at <= now\(\)/);
  });

  /**
   * Trashing a note is how most people revoke. The function predates Trash and
   * kept publishing a trashed note for the 30 days until the purge job ran.
   */
  it("refuses a trashed note", () => {
    expect(body).toMatch(/i\.deleted_at IS NOT NULL/);
  });

  it("gates every optional section on the owner's choice", () => {
    for (const flag of ["include_note", "include_summary", "include_refs"]) {
      expect(body).toContain(`s.${flag}`);
    }
  });

  it("never selects a column that identifies the owner or their vault", () => {
    // The RETURNS TABLE contract is the whole public surface; anything else
    // reaching it would be a leak, and these are the tempting ones.
    for (const forbidden of ["i.user_id", "i.folder_id", "i.tags", "s.user_id", "email"]) {
      expect(body).not.toContain(forbidden);
    }
  });

  it("is reachable only by the service role", () => {
    const files = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const last = files.reverse().find((f) => readFileSync(resolve(MIGRATIONS, f), "utf8").includes(SIGNATURE))!;
    const sql = readFileSync(resolve(MIGRATIONS, last), "utf8");
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.resolve_idea_share\(text\) FROM anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.resolve_idea_share\(text\) TO service_role/);
  });

  it("counts an access only after the note actually resolves", () => {
    // Otherwise access_count rises on links that return nothing, and the
    // number an owner reads as "someone opened this" means "someone tried".
    const lookup = body.indexOf("FROM public.ideas WHERE id = s.idea_id");
    const bump = body.indexOf("access_count = access_count + 1");
    expect(lookup).toBeGreaterThan(-1);
    expect(bump).toBeGreaterThan(lookup);
  });
});
