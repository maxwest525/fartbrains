import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

type Row = {
  id: string;
  title: string | null;
  raw_note: string | null;
  ai_summary: string | null;
  extracted_text: string | null;
  tags: string[] | null;
  folder_id: string | null;
  updated_at: string;
};

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "was", "were", "are", "you", "your",
  "about", "into", "what", "when", "how", "why", "can", "will", "any", "all", "not", "but",
]);

const terms = (q: string): string[] =>
  [...new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t)))];

const snippet = (text: string, keys: string[]): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  const lower = flat.toLowerCase();
  const hit = keys.map((k) => lower.indexOf(k)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, hit - 120);
  return (start > 0 ? "…" : "") + flat.slice(start, start + 360) + (flat.length > start + 360 ? "…" : "");
};

export default defineTool({
  name: "recall_context",
  title: "Recall second-brain context",
  description:
    "The main second-brain retrieval tool. Given a question or topic, returns the user's personal instructions plus the most relevant saved ideas as ranked snippets with the reason each was picked. Call this before answering questions that depend on what the user already knows or decided.",
  inputSchema: {
    query: z.string().trim().min(2).describe("The question or topic you need the user's own context for."),
    limit: z.number().int().min(1).max(15).optional().describe("Max snippets, default 6."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const keys = terms(query);

      const [{ data: rows, error }, { data: instructions }, { data: folders }] = await Promise.all([
        supabase
          .from("ideas")
          .select("id, title, raw_note, ai_summary, extracted_text, tags, folder_id, updated_at")
          .order("updated_at", { ascending: false })
          .limit(300),
        supabase
          .from("user_instructions")
          .select("general, capture, summarize, tagging, organizing")
          .maybeSingle(),
        supabase.from("folders").select("id, name"),
      ]);
      if (error) return errorResult(error.message);

      const folderNames = new Map<string, string>((folders ?? []).map((f) => [String(f.id), String(f.name)]));
      const now = Date.now();

      const scored = (rows ?? [] as Row[]).map((r) => {
        const row = r as Row;
        const haystack = [row.title, row.ai_summary, row.raw_note, row.extracted_text, (row.tags ?? []).join(" ")]
          .filter(Boolean)
          .join("\n");
        const lower = haystack.toLowerCase();
        const matched = keys.filter((k) => lower.includes(k));
        let score = matched.length * 3;
        if (row.title && keys.some((k) => row.title!.toLowerCase().includes(k))) score += 4;
        if ((row.tags ?? []).some((t) => keys.includes(String(t).toLowerCase()))) score += 3;
        const ageDays = (now - new Date(row.updated_at).getTime()) / 86_400_000;
        score += Math.max(0, 2 - ageDays / 45);
        return { row, score, matched, haystack };
      })
        .filter((s) => s.matched.length > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit ?? 6);

      return jsonResult({
        query,
        instructions: instructions ?? null,
        hits: scored.map(({ row, score, matched, haystack }) => ({
          idea_id: row.id,
          title: row.title,
          folder: row.folder_id ? folderNames.get(String(row.folder_id)) ?? null : null,
          tags: row.tags ?? [],
          updated_at: row.updated_at,
          score: Math.round(score * 100) / 100,
          why_selected: `matched: ${matched.join(", ")}`,
          snippet: snippet(haystack, matched),
        })),
      });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Recall failed");
    }
  },
});
