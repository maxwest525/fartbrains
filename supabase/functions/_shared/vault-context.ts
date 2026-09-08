// Lightweight keyword/overlap retrieval over the user's vault of ideas.
// No embeddings needed: scores title/tags/note/summary term overlap and recency.

import { fenceContent } from "./untrusted.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

export type VaultHit = {
  id: string;
  title: string;
  tags: string[];
  snippet: string;
  score: number;
  created_at: string;
  /** Query terms that actually matched this idea. */
  matchedTerms: string[];
  /** Human-readable explanation of why this idea was retrieved. */
  reason: string;
};

/** Builds a snippet window centred on the first matching term. */
const focusedSnippet = (source: string, terms: string[], len = 420): string => {
  const clean = (source || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const lower = clean.toLowerCase();
  let at = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0 || clean.length <= len) return clean.slice(0, len);
  const start = Math.max(0, at - Math.floor(len / 3));
  const end = Math.min(clean.length, start + len);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
};

const STOP = new Set(
  ("the a an and or but if then than that this these those of for to in on at by with from as is are was were be been being it its i me my we our you your they them he she " +
    "how what why when where which who do does did can could should would will just about into over under more most less give tell make help").split(" "),
);

const tokenize = (s: string): string[] =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOP.has(t));

const svc = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

/** A row as retrieval reads it. */
export type VaultRow = {
  id: string;
  title?: string | null;
  tags?: unknown;
  raw_note?: string | null;
  ai_summary?: string | null;
  extracted_text?: string | null;
  created_at: string;
};

const TITLE_WEIGHT = 6;
const TAG_WEIGHT = 4;
const BODY_WEIGHT = 2;

/**
 * Score and rank candidate rows against the query terms.
 *
 * Split out of the fetch so it can be tested: this is the part that decides what
 * Ash is allowed to know, and it had no tests at all.
 */
export function scoreRows(
  rows: VaultRow[],
  terms: string[],
  excludeIdeaId?: string,
  now = Date.now(),
): VaultHit[] {
  const scored: VaultHit[] = [];

  for (const row of rows) {
    if (excludeIdeaId && row.id === excludeIdeaId) continue;
    const title = String(row.title ?? "");
    const tags: string[] = Array.isArray(row.tags) ? row.tags.map(String) : [];
    const note = String(row.raw_note ?? "");
    const summary = String(row.ai_summary ?? "");
    const extracted = String(row.extracted_text ?? "").slice(0, 4000);

    const titleL = title.toLowerCase();
    const tagsL = tags.join(" ").toLowerCase();
    const bodyL = `${note}\n${summary}\n${extracted}`.toLowerCase();

    let score = 0;
    const titleHits: string[] = [];
    const tagHits: string[] = [];
    const bodyHits: string[] = [];
    for (const t of terms) {
      if (titleL.includes(t)) { score += TITLE_WEIGHT; titleHits.push(t); }
      if (tagsL.includes(t)) { score += TAG_WEIGHT; tagHits.push(t); }
      if (bodyL.includes(t)) { score += BODY_WEIGHT; bodyHits.push(t); }
    }
    if (score <= 0) continue;

    // Mild recency boost (up to +2 for something from today). Deliberately
    // small: it breaks ties between comparable matches, and must never let a
    // weak match from this morning outrank a strong one from last year.
    const ageDays = Math.max(0, (now - new Date(row.created_at).getTime()) / 86400000);
    const recencyBoost = Math.max(0, 2 - ageDays / 30);
    score += recencyBoost;

    const matchedTerms = [...new Set([...titleHits, ...tagHits, ...bodyHits])];
    const reasonParts: string[] = [];
    if (titleHits.length) reasonParts.push(`title matches ${titleHits.map((t) => `"${t}"`).join(", ")}`);
    if (tagHits.length) reasonParts.push(`tagged with ${tagHits.map((t) => `"${t}"`).join(", ")}`);
    if (bodyHits.length) reasonParts.push(`body mentions ${bodyHits.map((t) => `"${t}"`).join(", ")}`);
    if (recencyBoost > 1) reasonParts.push("captured recently");

    scored.push({
      id: row.id,
      title: title || "(untitled)",
      tags,
      snippet: focusedSnippet(summary || note || extracted, matchedTerms),
      score: Math.round(score * 10) / 10,
      created_at: row.created_at,
      matchedTerms,
      reason: reasonParts.join(" · "),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Terms safe to interpolate into a PostgREST filter.
 *
 * PostgREST does not take backslash escapes in filter values — a comma splits
 * the `or()` clause list, and `%`/`_` are wildcards — so escaping is not
 * available and pretending otherwise just hides the problem. `tokenize` already
 * strips everything but letters, digits and hyphens, so in practice nothing is
 * dropped here; this exists so that stays true if tokenize ever changes.
 */
const FILTER_SAFE = /^[a-z0-9-]+$/;

export const filterSafeTerms = (terms: string[]): string[] =>
  terms.filter((t) => FILTER_SAFE.test(t)).slice(0, MAX_FILTER_TERMS);

/**
 * Build the PostgREST `or` filter that narrows candidates in the database.
 *
 * Retrieval used to fetch the 400 most recently updated ideas and score those.
 * That is silently wrong past 400: older material becomes invisible to Ash,
 * which is the worst available failure mode because it still looks like an
 * answer. Filtering in the database instead means every idea is a candidate
 * regardless of vault size.
 *
 * `extracted_text` is matched too, despite holding whole transcripts. Leaving
 * it out looked like a reasonable performance trade until it was checked against
 * production: on the live vault, 9 of 85 matches for a sample term appear only
 * in extracted_text. That is 11% of results silently dropped — the same class of
 * bug as the 400-row window this change exists to remove, so it buys speed with
 * exactly the wrong currency.
 *
 * SCALING: every clause is an unindexed ilike, bounded by the user_id index. The
 * largest account today holds 224 ideas, where that is free. A trigram index
 * (`pg_trgm` + GIN on the four columns) is what this needs before any single
 * account reaches the low thousands.
 */
export const candidateFilter = (terms: string[]): string =>
  filterSafeTerms(terms)
    .flatMap((t) => [
      `title.ilike.%${t}%`,
      `ai_summary.ilike.%${t}%`,
      `raw_note.ilike.%${t}%`,
      `extracted_text.ilike.%${t}%`,
    ])
    .join(",");

/**
 * Terms past this do not narrow anything meaningful and each adds three clauses
 * to the query. Tokenize already drops stopwords, so six carries the question.
 */
const MAX_FILTER_TERMS = 6;

/** Most rows we will pull back and score in memory. */
const MAX_CANDIDATES = 300;

export async function retrieveVaultContext(opts: {
  userId: string;
  query: string;
  excludeIdeaId?: string;
  limit?: number;
}): Promise<VaultHit[]> {
  const limit = opts.limit ?? 5;
  const terms = [...new Set(tokenize(opts.query))];
  if (terms.length === 0) return [];

  try {
    const filter = candidateFilter(terms);

    let query = svc()
      .from("ideas")
      .select("id, title, tags, raw_note, ai_summary, extracted_text, created_at")
      .eq("user_id", opts.userId);
    // No safe term to filter on — an empty or() is a malformed query, so fall
    // back to the most recent window rather than asking for the whole vault.
    if (filter) query = query.or(filter);

    const { data, error } = await query
      .order("updated_at", { ascending: false })
      // A ceiling on rows returned, not on rows considered: the filter has
      // already run in the database, so this bounds payload rather than hiding
      // older ideas from the search the way the old unfiltered limit did.
      .limit(MAX_CANDIDATES);
    if (error || !data) return [];

    const scored = scoreRows(data as VaultRow[], terms, opts.excludeIdeaId);
    return scored.slice(0, limit);
  } catch (_e) {
    return [];
  }
}

export function renderVaultContext(hits: VaultHit[]): string {
  if (hits.length === 0) return "";
  // Titles and tags are fenced along with the snippets: a title is just the
  // first line of a captured page, so it is no more trustworthy than the body.
  const body = hits
    .map(
      (h, i) =>
        `${i + 1}. ${h.title}${h.tags.length ? ` [${h.tags.join(", ")}]` : ""}${h.reason ? `\n   (why: ${h.reason})` : ""}\n   ${h.snippet || "(no body)"}`,
    )
    .join("\n");
  return [
    "## Relevant context retrieved from the user's vault",
    "Use these only when they help. Cite them by title when you lean on one. Never invent vault content.",
    fenceContent(body),
  ].join("\n");
}

/* ------------------------------------------------------------------ *
 * Operational context: todos + calendar events.
 * Asher needs these to answer "what's on my list" style questions, so
 * they are always attached (small, bounded) rather than keyword-scored.
 * ------------------------------------------------------------------ */

export type OperationalContext = {
  todos: Array<{ title: string; done: boolean; due_at: string | null }>;
  events: Array<{ name: string; event_type: string; month: number | null; day: number | null; notes: string | null }>;
};

export async function retrieveOperationalContext(userId: string): Promise<OperationalContext> {
  const empty: OperationalContext = { todos: [], events: [] };
  try {
    const client = svc();
    const [todoRes, eventRes] = await Promise.all([
      client
        .from("todos")
        .select("title, done, due_at, created_at")
        .eq("user_id", userId)
        .order("done", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(40),
      client
        .from("calendar_events")
        .select("name, event_type, month, day, notes")
        .eq("user_id", userId)
        .limit(40),
    ]);
    return {
      todos: (todoRes.data ?? []).map((t) => ({
        title: String(t.title ?? ""),
        done: Boolean(t.done),
        due_at: (t.due_at as string | null) ?? null,
      })),
      events: (eventRes.data ?? []).map((e) => ({
        name: String(e.name ?? ""),
        event_type: String(e.event_type ?? "custom"),
        month: (e.month as number | null) ?? null,
        day: (e.day as number | null) ?? null,
        notes: (e.notes as string | null) ?? null,
      })),
    };
  } catch (_e) {
    return empty;
  }
}

export function renderOperationalContext(ctx: OperationalContext): string {
  // Todo titles and event notes are user-authored, but they are still content
  // rather than direction — and a todo can be created by an agent acting on a
  // captured page, which is how someone else's text reaches this list.
  const blocks: string[] = [];
  if (ctx.todos.length > 0) {
    const open = ctx.todos.filter((t) => !t.done);
    const done = ctx.todos.filter((t) => t.done).slice(0, 10);
    blocks.push(
      [
        "## The user's to-do list (live)",
        fenceContent(
          [
            open.length
              ? open.map((t) => `- [ ] ${t.title}${t.due_at ? ` (due ${t.due_at})` : ""}`).join("\n")
              : "- (nothing open)",
            done.length ? `Recently completed: ${done.map((t) => t.title).join("; ")}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (ctx.events.length > 0) {
    blocks.push(
      [
        "## The user's calendar events",
        fenceContent(
          ctx.events
            .map(
              (e) =>
                `- ${e.name} (${e.event_type}${e.month && e.day ? `, ${e.month}/${e.day}` : ""})${e.notes ? ` — ${e.notes}` : ""}`,
            )
            .join("\n"),
        ),
      ].join("\n"),
    );
  }
  return blocks.join("\n\n");
}
