import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_folders",
  title: "List folders",
  description: "List the user's vault folders with idea counts, so you can file new ideas in the right place.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const [{ data: folders, error }, { data: ideas }] = await Promise.all([
        supabase.from("folders").select("id, name, created_at").order("name"),
        supabase.from("ideas").select("folder_id"),
      ]);
      if (error) return errorResult(error.message);
      const counts = new Map<string, number>();
      for (const row of ideas ?? []) {
        const key = String(row.folder_id ?? "");
        if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return jsonResult({
        folders: (folders ?? []).map((f) => ({ ...f, idea_count: counts.get(String(f.id)) ?? 0 })),
        unfiled_count: (ideas ?? []).filter((r) => !r.folder_id).length,
      });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "List failed");
    }
  },
});
