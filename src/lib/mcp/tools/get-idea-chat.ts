import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_idea_chat",
  title: "Get idea brainstorm history",
  description:
    "Read the saved brainstorm conversation attached to one idea, so you can continue the user's earlier thinking instead of starting over.",
  inputSchema: {
    idea_id: z.string().uuid(),
    limit: z.number().int().min(1).max(200).optional().describe("Max messages, default 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ idea_id, limit }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase
        .from("idea_chats")
        .select("role, content, created_at")
        .eq("idea_id", idea_id)
        .order("created_at", { ascending: true })
        .limit(limit ?? 50);
      if (error) return errorResult(error.message);
      return jsonResult({ idea_id, messages: data ?? [] });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Read failed");
    }
  },
});
