import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_folder",
  title: "Create folder",
  description: "Create a new folder in the vault. Reuses the existing folder when the name already exists.",
  inputSchema: { name: z.string().trim().min(1).max(80) },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ name }, ctx) => {
    try {
      const userId = requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const { data: existing } = await supabase.from("folders").select("id, name").ilike("name", name).maybeSingle();
      if (existing) return jsonResult({ folder: existing, created: false });
      const { data, error } = await supabase
        .from("folders")
        .insert({ user_id: userId, name })
        .select("id, name, created_at")
        .maybeSingle();
      if (error) return errorResult(error.message);
      return jsonResult({ folder: data, created: true });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Create failed");
    }
  },
});
