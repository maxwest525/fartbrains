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
 * reel transcript, an article — into a brief good enough that the caller's own
 * agent can build from it. That agent is already sitting in the user's project
 * with their filesystem; it needs the brief, not the code.
 *
 * The chain already existed (transcribe -> summarize -> generate-prompt) but was
 * reachable only from an idea detail page, so an agent connected over MCP could
 * read the vault and never get the one artifact worth shipping.
 *
 * Retrieval is what separates this from a summarizer. A brief built from one
 * reel in isolation ignores everything the user already decided; we pull the
 * neighbouring material so the brief continues their thinking.
 *
 * Three strategies, in order of how much they reflect the user's own judgement:
 * the folder they filed it in, then tags they applied, then full-text search on
 * the idea's own title. The third matters more than it looks: filing and
 * tagging are chores, so a large share of any real vault is loose — and loose
 * brain-dump material is the part most in need of being connected to
 * something. Without it, that share would get no context at all.
 */

/** How many neighbouring ideas to feed in as continuity context. */
const CONTEXT_LIMIT = 6;
/** Per-neighbour budget, so one long transcript can't crowd out the rest. */
const CONTEXT_CHARS_EACH = 900;

type Neighbour = {
  id: string;
  title: string;
  ai_summary: string | null;
  raw_note: string | null;
  tags: string[] | null;
};

/**
 * Words from a title worth searching on. Drops the connective tissue that would
 * match half the vault, and anything too short to be a real term.
 */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how", "in",
  "into", "is", "it", "of", "on", "or", "that", "the", "this", "to", "using",
  "what", "when", "why", "with", "your",
]);

export function titleTerms(title: string, max = 6): string[] {
  return [
    ...new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
    ),
  ].slice(0, max);
}

function renderContext(rows: Neighbour[]): string {
  return rows
    .map((r) => {
      const body = (r.ai_summary ?? r.raw_note ?? "").trim().slice(0, CONTEXT_CHARS_EACH);
      const tags = r.tags?.length ? ` [${r.tags.join(", ")}]` : "";
      return body ? `- ${r.title}${tags}: ${body}` : `- ${r.title}${tags}`;
    })
    .join("\n");
}

export default defineTool({
  name: "build_prompt",
  title: "Build a prompt or build brief from a saved idea",
  description:
    "Turn a saved idea — including a captured reel, video or article transcript — into something the calling agent can act on. mode 'build' returns a build brief written for an agent that has the user's project open: mechanism, ordered steps, how to adapt it to their stack, how to verify it, and what not to do. mode 'paste' returns a short prompt for a human to paste into a chat. Pulls in neighbouring saved ideas for continuity. Returns the text without saving anything.",
  inputSchema: {
    idea_id: z
      .string()
      .uuid()
      .describe("The saved idea to build from. Find it with search_ideas."),
    goal: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .describe(
        "What the user wants out of it — 'build an MVP', 'write a spec', 'turn this into a landing page'. Steers the output; leave empty for a general-purpose one.",
      ),
    mode: z
      .enum(["build", "paste"])
      .optional()
      .describe(
        "'build' (default) for a brief you are going to act on yourself. 'paste' for a short prompt the user will paste into a chat elsewhere.",
      ),
    stack: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .describe(
        "The project you have open — language, framework, hosting, notable constraints. Supply this whenever you know it; the brief is adapted to it, and without it the brief has to guess.",
      ),
    use_context: z
      .boolean()
      .optional()
      .describe(
        "Include neighbouring saved ideas (same folder, then shared tags) so the brief builds on what the user already decided. Default true.",
      ),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ idea_id, goal, mode, stack, use_context }, ctx) => {
    try {
      requireAuth(ctx);
      const supabase = supabaseForUser(ctx);

      // RLS scopes this to the caller; the deleted_at filter keeps trashed
      // material out of anything the agent acts on.
      const { data, error } = await supabase
        .from("ideas")
        .select(
          "title, raw_note, ai_summary, extracted_text, source_url, source_label, folder_id, tags",
        )
        .eq("id", idea_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) return errorResult(error.message);
      if (!data) return errorResult("No such idea, or it is in the Trash.");

      // Continuity: the folder is the user's own grouping, so prefer it. Fall
      // back to tag overlap when the idea is loose. Both go through RLS and
      // both exclude the Trash and the idea itself.
      let neighbours: Neighbour[] = [];
      if (use_context !== false) {
        const base = () =>
          supabase
            .from("ideas")
            .select("id, title, ai_summary, raw_note, tags")
            .is("deleted_at", null)
            .neq("id", idea_id)
            .order("updated_at", { ascending: false })
            .limit(CONTEXT_LIMIT);

        if (data.folder_id) {
          const { data: rows } = await base().eq("folder_id", data.folder_id);
          neighbours = rows ?? [];
        }
        if (neighbours.length === 0 && data.tags?.length) {
          const { data: rows } = await base().overlaps("tags", data.tags);
          neighbours = rows ?? [];
        }
        if (neighbours.length === 0) {
          // Unfiled and untagged: fall back to the full-text index, using the
          // idea's own title as the query. OR rather than AND, because an exact
          // multi-word match would be rarer than no match at all.
          const terms = titleTerms(data.title);
          if (terms.length) {
            const { data: rows } = await base().textSearch(
              "search_vector",
              terms.join(" OR "),
              { type: "websearch" },
            );
            neighbours = rows ?? [];
          }
        }
      }

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
        mode: mode ?? "build",
        stack,
        context: neighbours.length ? renderContext(neighbours) : undefined,
      });

      const prompt = String(res.prompt ?? "").trim();
      if (!prompt) return errorResult("Couldn't build anything from that idea.");

      return jsonResult({
        prompt,
        // Cite what it was built from, so the caller can show its working
        // rather than presenting the brief as having appeared from nowhere.
        built_from: {
          idea_id,
          title: data.title,
          mode: mode ?? "build",
          source_url: data.source_url ?? null,
          source_label: data.source_label ?? null,
          used_summary: Boolean(data.ai_summary),
          used_transcript: Boolean(data.extracted_text),
          used_stack: Boolean(stack?.trim()),
          context_ideas: neighbours.map((n) => ({ id: n.id, title: n.title })),
        },
      });
    } catch (e) {
      return errorResult(e instanceof Error ? e.message : "Couldn't build a prompt");
    }
  },
});
