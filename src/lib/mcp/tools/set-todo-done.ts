import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "set_todo_done",
  title: "Complete or reopen todo",
  description: "Mark a todo complete, or reopen it by passing done=false.",
  inputSchema: {
    todo_id: z.string().uuid(),
    done: z.boolean().optional().describe("Default true."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ todo_id, done }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const isDone = done !== false;
      const { data, error } = await supabase
        .from("todos")
        .update({
          done: isDone,
          completed_at: isDone ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", todo_id)
        .select("id, title, done, completed_at")
        .maybeSingle();
      if (error) return errorResult(error.message);
      if (!data) return errorResult("Todo not found");
      return jsonResult({ todo: data });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Update failed");
    }
  },
});
