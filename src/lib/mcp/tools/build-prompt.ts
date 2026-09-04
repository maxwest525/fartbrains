import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  callFunction,
  errorResult,
  jsonResult,
  requireAuth,
  supabaseForUser,
} from "../supabase";

/**
 * The point of the product, exposed where it is useful.
 *
 * Fartbrains does not build anything. It turns captured material — an idea, a
 * reel transcript, an article — into a prompt good enough that the caller's own
 * agent can build from it. That agent is already sitting in the user's project
 * with their filesystem; it needs the brief, not the code.
 *
 * The chain already existed (transcribe -> summarize -> generate-prompt) but was
 * reachable only from an idea detail page, so an agent connected over MCP could
 * read the vault and never get the one artifact worth shipping.
 */
export default defineTool({
  name: "build_prompt",
  title: "Build a prompt from a saved idea",
  description:
    "Turn a saved idea — including a captured reel, video or article transcript — into a ready-to-use prompt the calling agent can act on. Use this when the user wants to build, spec or act on something they saved, rather than just read it back. Returns the prompt without saving anything.",
  inputSchema: {
    idea_id: z
      .string()
      .uuid()
      .describe("The saved idea to turn into a prompt. Find it with search_ideas."),
    goal: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .describe(
        "What the user wants out of it — 'build an MVP', 'write a spec', 'turn this into a landing page'. Steers the prompt; leave empty for a general-purpose one.",
      ),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ idea_id, goal }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);

      // RLS scopes this to the caller; the deleted_at filter keeps trashed
      // material out of anything the agent acts on.
      const { data, error } = await supabase
        .from("ideas")
        .select("title, raw_note, ai_summary, extracted_text, source_url, source_label")
        .eq("id", idea_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) return errorResult(error.message);
      if (!data) return errorResult("No such idea, or it is in the Trash.");

      const note = [data.raw_note ?? "", goal ? `Goal: ${goal}` : ""]
        .filter(Boolean)
        .join("\n\n");

      const res = await callFunction<{ prompt?: string }>(ctx, "generate-prompt", {
        title: data.title,
        note,
        summary: data.ai_summary,
        extractedText: data.extracted_text,
        sourceUrl: data.source_url,
        sourceLabel: data.source_label,
      });

      const prompt = String(res.prompt ?? "").trim();
      if (!prompt) return errorResult("Couldn't build a prompt from that idea.");

      return jsonResult({
        prompt,
        // Cite what it was built from, so the caller can show its working
        // rather than presenting the prompt as having appeared from nowhere.
        built_from: {
          idea_id,
          title: data.title,
          source_url: data.source_url ?? null,
          source_label: data.source_label ?? null,
          used_summary: Boolean(data.ai_summary),
          used_transcript: Boolean(data.extracted_text),
        },
      });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Couldn't build a prompt");
    }
  },
});
