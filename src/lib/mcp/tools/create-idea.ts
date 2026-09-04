import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

const SOURCE_TYPES = ["manual", "webpage", "transcript", "audio", "youtube", "instagram", "tiktok"] as const;

export default defineTool({
  name: "create_idea",
  title: "Create idea",
  description:
    "Save a new idea, note or captured text into the user's second brain. Use this whenever the user wants something remembered.",
  inputSchema: {
    title: z.string().trim().min(1).max(200).describe("Short title for the idea."),
    note: z.string().trim().optional().describe("The note body / raw text to store verbatim."),
    summary: z.string().trim().optional().describe("Optional summary of the note."),
    folder_id: z.string().uuid().optional().describe("Folder to file it under."),
    tags: z.array(z.string().trim().min(1)).max(12).optional().describe("Tags for retrieval."),
    source_url: z.string().url().optional().describe("Where the idea came from, if any."),
    source_type: z.enum(SOURCE_TYPES).optional().describe("Capture path. Default manual."),
    priority: z.enum(["none", "low", "medium", "high"]).optional(),
    is_favorite: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    try {
      const userId = requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase
        .from("ideas")
        .insert({
          user_id: userId,
          title: input.title,
          raw_note: input.note ?? null,
          ai_summary: input.summary ?? null,
          folder_id: input.folder_id ?? null,
          tags: input.tags ?? [],
          source_url: input.source_url ?? null,
          source_type: input.source_type ?? "manual",
          priority: input.priority ?? "none",
          is_favorite: input.is_favorite ?? false,
        })
        .select()
        .maybeSingle();
      if (error) return errorResult(error.message);
      return jsonResult({ idea: data });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Create failed");
    }
  },
});
