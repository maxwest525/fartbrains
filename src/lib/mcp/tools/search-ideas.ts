import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";
import { likeFilterValue } from "@/lib/searchTerm";

/**
 * search_ideas() returns whole rows, transcripts included. A single captured
 * video can be tens of thousands of characters, so handing raw rows to an
 * agent would spend its context on material it did not ask for. Project down
 * to the same fields the unranked path selects; get_idea fetches the body
 * when the caller actually wants it.
 */
const LIST_FIELDS = [
  "id", "title", "ai_summary", "raw_note", "tags", "folder_id", "source_type",
  "source_url", "is_favorite", "priority", "created_at", "updated_at",
] as const;

function toListItem(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of LIST_FIELDS) out[f] = row[f] ?? null;
  return out;
}

/**
 * PostgREST reports an absent RPC as 404 / PGRST202. Treated as "not migrated
 * yet" rather than as a failure, so search degrades to unranked instead of
 * breaking between merge and migration.
 */
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST202" || /Could not find the function/i.test(error.message ?? "");
}

export default defineTool({
  name: "search_ideas",
  title: "Search ideas",
  description:
    "Search the signed-in user's second brain for saved ideas and notes. Matches title, note body, summary and extracted text. Use this before answering anything about what the user has already captured.",
  inputSchema: {
    query: z.string().trim().optional().describe("Free-text search. Omit to list the most recent ideas."),
    folder_id: z.string().uuid().optional().describe("Restrict results to one folder."),
    tag: z.string().trim().optional().describe("Restrict results to ideas carrying this tag."),
    favorites_only: z.boolean().optional().describe("Only return favorited ideas."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results, default 15."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, folder_id, tag, favorites_only, limit }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      let q = supabase
        .from("ideas")
        .select("id, title, ai_summary, raw_note, tags, folder_id, source_type, source_url, is_favorite, priority, created_at, updated_at")
        // Something the user deleted must not come back through the agent.
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(limit ?? 15);

      if (folder_id) q = q.eq("folder_id", folder_id);
      if (favorites_only) q = q.eq("is_favorite", true);
      if (tag) q = q.contains("tags", [tag]);
      // Ranked path first. search_ideas() orders by ts_rank over the weighted
      // search_vector, so a title match beats a passing mention in a
      // transcript — which plain ILIKE cannot express at all.
      if (query?.trim()) {
        const { data, error } = await supabase.rpc("search_ideas", {
          q: query,
          folder: folder_id ?? null,
          tag: tag ?? null,
          favorites_only: favorites_only ?? false,
          max_results: limit ?? 15,
        });
        if (!error) {
          const rows = (data ?? []) as Array<Record<string, unknown>>;
          return jsonResult({ count: rows.length, ranked: true, ideas: rows.map(toListItem) });
        }
        // The migration adding the function may not be applied yet. Falling
        // through keeps search working rather than returning an error the
        // caller cannot act on; the results are just unranked.
        if (!isMissingFunction(error)) return errorResult(error.message);
      }

      if (query) {
        // Previously this stripped %,() from the query — which silently
        // changed what the user searched for. Escaping keeps the term intact.
        const value = likeFilterValue(query);
        if (value) {
          q = q.or(
            ["title", "raw_note", "ai_summary", "extracted_text"]
              .map((c) => `${c}.ilike.${value}`)
              .join(","),
          );
        }
      }

      const { data, error } = await q;
      if (error) return errorResult(error.message);
      return jsonResult({ count: data?.length ?? 0, ranked: false, ideas: data ?? [] });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Search failed");
    }
  },
});
