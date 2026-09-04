import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "delete_idea",
  title: "Delete idea",
  description: "Permanently delete one idea from the user's vault. Confirm with the user before calling this.",
  inputSchema: { idea_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ idea_id }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const { error } = await supabase.from("ideas").delete().eq("id", idea_id);
      if (error) return errorResult(error.message);
      return textResult(`Deleted idea ${idea_id}`);
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Delete failed");
    }
  },
});
