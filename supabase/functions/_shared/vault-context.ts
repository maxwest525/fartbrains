// Lightweight keyword/overlap retrieval over the user's vault of ideas.
// No embeddings needed: scores title/tags/note/summary term overlap and recency.

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
    const { data, error } = await svc()
      .from("ideas")
      .select("id, title, tags, raw_note, ai_summary, extracted_text, created_at")
      .eq("user_id", opts.userId)
      .order("updated_at", { ascending: false })
      .limit(400);
    if (error || !data) return [];

    const now = Date.now();
    const scored: VaultHit[] = [];

    for (const row of data) {
      if (opts.excludeIdeaId && row.id === opts.excludeIdeaId) continue;
      const title = String(row.title ?? "");
      const tags: string[] = Array.isArray(row.tags) ? row.tags.map(String) : [];
      const note = String(row.raw_note ?? "");
      const summary = String(row.ai_summary ?? "");
      const extracted = String(row.extracted_text ?? "").slice(0, 4000);

      const titleL = title.toLowerCase();
      const tagsL = tags.join(" ").toLowerCase();
      const bodyL = `${note}\n${summary}\n${extracted}`.toLowerCase();

      let score = 0;
      for (const t of terms) {
        if (titleL.includes(t)) score += 6;
        if (tagsL.includes(t)) score += 4;
        if (bodyL.includes(t)) score += 2;
      }
      if (score <= 0) continue;

      // Mild recency boost (up to +2 for something from today).
      const ageDays = Math.max(0, (now - new Date(row.created_at).getTime()) / 86400000);
      score += Math.max(0, 2 - ageDays / 30);

      const snippetSource = summary || note || extracted;
      scored.push({
        id: row.id,
        title: title || "(untitled)",
        tags,
        snippet: snippetSource.replace(/\s+/g, " ").trim().slice(0, 420),
        score: Math.round(score * 10) / 10,
        created_at: row.created_at,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  } catch (_e) {
    return [];
  }
}

export function renderVaultContext(hits: VaultHit[]): string {
  if (hits.length === 0) return "";
  return [
    "## Relevant context retrieved from the user's vault",
    "Use these only when they help. Cite them by title when you lean on one. Never invent vault content.",
    ...hits.map(
      (h, i) =>
        `${i + 1}. ${h.title}${h.tags.length ? ` [${h.tags.join(", ")}]` : ""}\n   ${h.snippet || "(no body)"}`,
    ),
  ].join("\n");
}
