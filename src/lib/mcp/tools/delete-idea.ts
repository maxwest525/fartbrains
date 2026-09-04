import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, requireAuth, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "delete_idea",
  title: "Delete idea",
  description:
    "Move one idea to the user's Trash. It stops being searchable and any share links for it are revoked, but it stays recoverable for 30 days. Confirm with the user before calling this.",
  inputSchema: { idea_id: z.string().uuid() },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ idea_id }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      // Soft delete, matching the app: an agent acting on a fuzzy instruction
      // must not be able to destroy a captured thought with no undo. The app's
      // Trash view restores it, and a database trigger revokes its share links.
      const { error } = await supabase
        .from("ideas")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", idea_id)
        .is("deleted_at", null);
      if (error) return errorResult(error.message);
      return textResult(
        `Moved idea ${idea_id} to Trash. It can be restored from Trash in the app for 30 days.`,
      );
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Delete failed");
    }
  },
});
