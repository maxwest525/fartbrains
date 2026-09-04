import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

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
        .order("updated_at", { ascending: false })
        .limit(limit ?? 15);

      if (folder_id) q = q.eq("folder_id", folder_id);
      if (favorites_only) q = q.eq("is_favorite", true);
      if (tag) q = q.contains("tags", [tag]);
      if (query) {
        const safe = query.replace(/[%,()]/g, " ").trim();
        if (safe) {
          q = q.or(
            ["title", "raw_note", "ai_summary", "extracted_text"]
              .map((c) => `${c}.ilike.%${safe}%`)
              .join(","),
          );
        }
      }

      const { data, error } = await q;
      if (error) return errorResult(error.message);
      return jsonResult({ count: data?.length ?? 0, ideas: data ?? [] });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Search failed");
    }
  },
});
