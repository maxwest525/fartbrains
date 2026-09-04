import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_todo",
  title: "Create todo",
  description: "Add a todo to the user's list, with an optional due date.",
  inputSchema: {
    title: z.string().trim().min(1).max(200),
    due_at: z.string().datetime().optional().describe("ISO 8601 due timestamp."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, due_at }, ctx) => {
    try {
      const userId = requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase
        .from("todos")
        .insert({ user_id: userId, title, due_at: due_at ?? null })
        .select("id, title, done, due_at, created_at")
        .maybeSingle();
      if (error) return errorResult(error.message);
      return jsonResult({ todo: data });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Create failed");
    }
  },
});
