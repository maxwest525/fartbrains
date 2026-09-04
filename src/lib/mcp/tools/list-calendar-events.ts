import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_calendar_events",
  title: "List calendar events",
  description:
    "List the user's saved dates: birthdays, anniversaries and other recurring events, optionally filtered to one month.",
  inputSchema: {
    month: z.number().int().min(1).max(12).optional().describe("Filter to a calendar month (1-12)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ month }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      let q = supabase
        .from("calendar_events")
        .select("id, name, event_type, month, day, birth_year, emoji, notes, floating_key")
        .order("month")
        .order("day");
      if (month) q = q.eq("month", month);
      const { data, error } = await q;
      if (error) return errorResult(error.message);
      return jsonResult({ count: data?.length ?? 0, events: data ?? [] });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "List failed");
    }
  },
});
