import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callFunction, errorResult, jsonResult, requireAuth } from "../supabase";

export default defineTool({
  name: "summarize_text",
  title: "Summarize text",
  description:
    "Summarize a transcript or long passage using the user's own summarizing rules. Returns the summary and a suggested title without saving anything.",
  inputSchema: {
    text: z.string().trim().min(40).describe("The transcript or passage to summarize."),
    kind: z.enum(["manual", "webpage", "transcript", "audio"]).optional().describe("Content kind. Default transcript."),
    note: z.string().trim().max(2000).optional().describe("The user's framing or question about the text."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ text, kind, note }, ctx) => {
    try {
      requireAuth(ctx);
      const res = await callFunction<{ summary?: string; suggestedTitle?: string }>(ctx, "summarize", {
        text,
        kind: kind ?? "transcript",
        userNote: note ?? "",
      });
      return jsonResult({ summary: res.summary ?? "", suggested_title: res.suggestedTitle ?? null });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Summarize failed");
    }
  },
});
