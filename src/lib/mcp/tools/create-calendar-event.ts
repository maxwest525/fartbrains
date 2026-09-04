import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_calendar_event",
  title: "Create calendar event",
  description: "Save a birthday, anniversary or other recurring date the user wants remembered.",
  inputSchema: {
    name: z.string().trim().min(1).max(120).describe("Who or what the date is for."),
    event_type: z.string().trim().min(1).max(40).describe("For example birthday, anniversary, holiday."),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
    birth_year: z.number().int().min(1900).max(2200).optional(),
    emoji: z.string().trim().max(8).optional(),
    notes: z.string().trim().max(2000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    try {
      const userId = requireAuth(ctx);
      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase
        .from("calendar_events")
        .insert({
          user_id: userId,
          name: input.name,
          event_type: input.event_type,
          month: input.month ?? null,
          day: input.day ?? null,
          birth_year: input.birth_year ?? null,
          emoji: input.emoji ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .maybeSingle();
      if (error) return errorResult(error.message);
      return jsonResult({ event: data });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Create failed");
    }
  },
});
