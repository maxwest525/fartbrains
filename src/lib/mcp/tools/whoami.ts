import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description:
    "Confirm which vault account this connection is acting as, plus a quick size summary of the vault. Useful for verifying the connection works.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      if (!ctx.isAuthenticated()) return jsonResult({ authenticated: false });
      const supabase = supabaseForUser(ctx);
      const [{ count: ideaCount }, { count: folderCount }, { count: todoCount }] = await Promise.all([
        supabase.from("ideas").select("id", { count: "exact", head: true }),
        supabase.from("folders").select("id", { count: "exact", head: true }),
        supabase.from("todos").select("id", { count: "exact", head: true }),
      ]);
      return jsonResult({
        authenticated: true,
        user_id: ctx.getUserId(),
        email: ctx.getUserEmail() ?? null,
        vault: { ideas: ideaCount ?? 0, folders: folderCount ?? 0, todos: todoCount ?? 0 },
      });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Lookup failed");
    }
  },
});
