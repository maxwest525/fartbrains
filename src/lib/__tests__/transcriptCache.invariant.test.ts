import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * `transcript_cache` has no `user_id`. It is a shared, cross-account table,
 * which is only safe because everything in it is public media that any
 * customer could fetch for themselves — a YouTube video, an Instagram reel.
 *
 * A voice note is the opposite: authored by one person, and the single most
 * private thing the product handles. Writing one into this table would put
 * it where every other account's transcription lookups can reach it.
 *
 * Nothing in the type system says so, and the mistake would be one import
 * away in a function that already has the audio in hand. These tests read the
 * edge function sources and fail if that import ever appears somewhere it
 * must not, or if the table is queried outside the one module that owns it.
 *
 * They run in the app's test suite because the Deno functions have no runner
 * of their own; the assertions are about source text, so that works fine.
 */

const FUNCTIONS = resolve(__dirname, "../../../supabase/functions");

/** The only functions permitted to write the shared cache. */
const PUBLIC_MEDIA_FUNCTIONS = ["transcribe-youtube", "transcribe-instagram"];

/** The module that owns the table. */
const OWNER = "_shared/transcripts.ts";

const functionDirs = (): string[] =>
  readdirSync(FUNCTIONS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
    .map((e) => e.name);

const sourceOf = (dir: string): string => {
  const p = resolve(FUNCTIONS, dir, "index.ts");
  return existsSync(p) ? readFileSync(p, "utf8") : "";
};

describe("the shared transcript cache holds public media only", () => {
  it("is written by the public-media transcribers and nothing else", () => {
    const writers = functionDirs().filter((d) => /\bstoreTranscript\b/.test(sourceOf(d)));
    expect(writers.sort()).toEqual([...PUBLIC_MEDIA_FUNCTIONS].sort());
  });

  it("is never touched by the voice-note path", () => {
    const src = sourceOf("transcribe-deliverables");
    expect(src.length).toBeGreaterThan(0); // the function still exists
    expect(src).not.toMatch(/storeTranscript|lookupTranscript|transcript_cache/);
  });

  it("is queried only through the module that owns it", () => {
    const callers = functionDirs().filter((d) => /"transcript_cache"/.test(sourceOf(d)));
    expect(callers).toEqual([]);
    expect(readFileSync(resolve(FUNCTIONS, OWNER), "utf8")).toContain('"transcript_cache"');
  });

  it("refuses to write without a stable public id", () => {
    // cacheKey returning null is what stops a keyless caller from writing at
    // all; storeTranscript must return on that rather than inventing a key.
    const owner = readFileSync(resolve(FUNCTIONS, OWNER), "utf8");
    const body = owner.slice(owner.indexOf("export async function storeTranscript"));
    expect(body).toMatch(/if \(!key\b[\s\S]{0,60}?\) return;/);
  });
});
