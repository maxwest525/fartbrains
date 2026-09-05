import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_idea",
  title: "Update idea",
  description:
    "Edit an existing idea: retitle it, rewrite the note, set the summary or generated prompt, move folders, change tags, priority or favorite state. Only the fields you pass change.",
  inputSchema: {
    idea_id: z.string().uuid(),
    title: z.string().trim().min(1).max(200).optional(),
    note: z.string().trim().optional().describe("Replaces raw_note."),
    summary: z.string().trim().optional(),
    generated_prompt: z.string().trim().optional().describe("Reusable AI prompt derived from the idea."),
    folder_id: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().trim().min(1)).max(12).optional(),
    priority: z.enum(["none", "low", "medium", "high"]).optional(),
    is_favorite: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ idea_id, note, summary, ...rest }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const patch: Record<string, unknown> = { ...rest };
      if (note !== undefined) patch.raw_note = note;
      if (summary !== undefined) patch.ai_summary = summary;
      if (Object.keys(patch).length === 0) return errorResult("Nothing to update");
      patch.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("ideas")
        .update(patch)
        .eq("id", idea_id)
        // A trashed idea matches nothing, so an edit to one reports not found
        // rather than succeeding into a note the user can no longer see.
        .is("deleted_at", null)
        .select()
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult("Idea not found, or it is in the Trash.");
      return jsonResult({ idea: data });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Update failed");
    }
  },
});
