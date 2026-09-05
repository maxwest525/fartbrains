import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, requireLiveIdea, supabaseForUser } from "../supabase";

export default defineTool({
  name: "append_idea_chat",
  title: "Append to idea brainstorm",
  description:
    "Append a message to an idea's brainstorm thread so the conversation you are having shows up inside the app next to that idea.",
  inputSchema: {
    idea_id: z.string().uuid(),
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(20000),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ idea_id, role, content }, ctx) => {
    try {
      const userId = requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      // Writing into a trashed idea's thread succeeds silently: nothing in the
      // app renders it, so the agent reports progress the user cannot see.
      const dead = await requireLiveIdea(supabase, idea_id);
      if (dead) return errorResult(dead.error);
      const { data, error } = await supabase
        .from("idea_chats")
        .insert({ user_id: userId, idea_id, role, content })
        .select("id, role, created_at")
        .maybeSingle();
      if (error) return errorResult(error.message);
      return jsonResult({ message: data });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Append failed");
    }
  },
});
