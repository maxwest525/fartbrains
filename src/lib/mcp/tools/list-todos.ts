import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_todos",
  title: "List todos",
  description: "List the user's todos, newest first. Defaults to open items only.",
  inputSchema: {
    include_done: z.boolean().optional().describe("Include completed todos. Default false."),
    limit: z.number().int().min(1).max(100).optional().describe("Max results, default 30."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ include_done, limit }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      let q = supabase
        .from("todos")
        .select("id, title, done, due_at, completed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(limit ?? 30);
      if (!include_done) q = q.eq("done", false);
      const { data, error } = await q;
      if (error) return errorResult(error.message);
      return jsonResult({ count: data?.length ?? 0, todos: data ?? [] });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "List failed");
    }
  },
});
