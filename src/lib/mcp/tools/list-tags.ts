import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tags",
  title: "List tags",
  description:
    "List every tag used in the vault with its frequency. Use it to reuse the user's own vocabulary instead of inventing new tags.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase.from("ideas").select("tags");
      if (error) return errorResult(error.message);
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        for (const tag of Array.isArray(row.tags) ? row.tags : []) {
          const key = String(tag).trim();
          if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      const tags = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([tag, count]) => ({ tag, count }));
      return jsonResult({ tags });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "List failed");
    }
  },
});
