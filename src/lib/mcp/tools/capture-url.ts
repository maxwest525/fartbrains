import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { callFunction, errorResult, jsonResult, requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "capture_url",
  title: "Capture a URL",
  description:
    "Fetch a web page, extract its readable text, summarize it, and save the result as an idea in the vault. Use this when the user shares a link they want kept.",
  inputSchema: {
    url: z.string().url().describe("Public http(s) URL to capture."),
    folder_id: z.string().uuid().optional().describe("Folder to file the capture under."),
    note: z.string().trim().max(2000).optional().describe("The user's own note about why this matters."),
    save: z.boolean().optional().describe("Save to the vault. Default true; pass false to preview only."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async ({ url, folder_id, note, save }, ctx) => {
    try {
      const userId = requireAuth(ctx);

      const extracted = await callFunction<{ title?: string; text?: string; siteName?: string }>(
        ctx,
        "extract-url",
        { url },
      );
      const text = String(extracted.text ?? "").trim();
      if (!text) return errorResult("Could not extract readable text from that URL.");

      let summary: string | null = null;
      let suggestedTitle: string | null = null;
      try {
        const s = await callFunction<{ summary?: string; suggestedTitle?: string }>(ctx, "summarize", {
          text,
          kind: "webpage",
          userNote: note ?? "",
        });
        summary = s.summary ?? null;
        suggestedTitle = s.suggestedTitle ?? null;
      } catch {
        // Summary is best-effort; the extracted text is still worth saving.
      }

      const title = String(extracted.title ?? suggestedTitle ?? url).slice(0, 200);
      if (save === false) {
        return jsonResult({ saved: false, title, summary, extracted_text: text.slice(0, 4000), source_url: url });
      }

      const supabase = supabaseForUser(ctx);
      const { data, error } = await supabase
        .from("ideas")
        .insert({
          user_id: userId,
          title,
          raw_note: note ?? null,
          extracted_text: text,
          ai_summary: summary,
          source_url: url,
          source_type: "webpage",
          source_label: extracted.siteName ?? null,
          folder_id: folder_id ?? null,
        })
        .select("id, title, ai_summary, source_url, folder_id, created_at")
        .maybeSingle();
      if (error) return errorResult(error.message);
      return jsonResult({ saved: true, idea: data });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Capture failed");
    }
  },
});
