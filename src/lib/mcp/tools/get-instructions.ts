import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_instructions",
  title: "Get personal instructions",
  description:
    "Read the user's standing personal instructions for how their second brain should behave (general style, capture, summarizing, tagging, organizing). Call this first in a new session and follow the rules it returns.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase
        .from("user_instructions")
        .select("general, capture, summarize, tagging, organizing, updated_at")
        .maybeSingle();
      if (error) return errorResult(error.message);
      return jsonResult({
        instructions:
          data ?? { general: "", capture: "", summarize: "", tagging: "", organizing: "", updated_at: null },
        has_instructions: Boolean(data),
      });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Read failed");
    }
  },
});
