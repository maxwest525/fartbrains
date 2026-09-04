import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_idea",
  title: "Get idea",
  description:
    "Read one saved idea in full: note body, AI summary, extracted source text, generated prompt, tags, folder and linked references.",
  inputSchema: {
    idea_id: z.string().uuid().describe("The idea id."),
    include_references: z.boolean().optional().describe("Also return auto-extracted reference links. Default true."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ idea_id, include_references }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase
        .from("ideas")
        .select("*")
        .eq("id", idea_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult("Idea not found");

      let folderName: string | null = null;
      if (data.folder_id) {
        const { data: folder } = await supabase.from("folders").select("name").eq("id", data.folder_id).maybeSingle();
        folderName = folder?.name ?? null;
      }

      let references: unknown[] = [];
      if (include_references !== false) {
        const { data: refs } = await supabase
          .from("idea_references")
          .select("*")
          .eq("idea_id", idea_id);
        references = refs ?? [];
      }

      return jsonResult({ idea: { ...data, folder_name: folderName }, references });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Read failed");
    }
  },
});
