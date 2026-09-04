// Single source of truth for how Asher's system prompt is assembled, so the
// prompt-preview panel and the actual chat call can never drift apart.

import { instructionBlock } from "./instructions.ts";
import {
  renderOperationalContext,
  renderVaultContext,
  retrieveOperationalContext,
  retrieveVaultContext,
  type VaultHit,
} from "./vault-context.ts";

export const ASHER_BASE_PROMPT = `You are Asher — the user's personal second-brain assistant living inside their idea vault.
- Be direct, warm, and concise. No corporate filler.
- The user is a single power user. Speak to them, not "users".
- When they ask for a todo, idea, reminder, or plan, give a tight actionable answer.
- Markdown is fine. Keep replies short unless they ask for depth.`;

export type IdeaContext = {
  id: string;
  title: string | null;
  raw_note: string | null;
  ai_summary: string | null;
  generated_prompt: string | null;
  extracted_text: string | null;
};

export function renderIdeaContext(idea: IdeaContext): string {
  return [
    "## The idea in focus",
    `Title: ${idea.title || "(untitled)"}`,
    idea.raw_note ? `\nUser's note:\n${idea.raw_note}` : "",
    idea.ai_summary ? `\nAI summary:\n${idea.ai_summary}` : "",
    idea.generated_prompt ? `\nGenerated prompt:\n${idea.generated_prompt}` : "",
    idea.extracted_text ? `\nExtracted context (truncated):\n${idea.extracted_text.slice(0, 3000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export type AsherPromptResult = {
  systemPrompt: string;
  instructions: string;
  vaultContext: string;
  ideaContext: string;
  /** Rendered to-do + calendar block, so the preview panel can show it too. */
  operationalContext: string;
  hits: VaultHit[];
};

export async function buildAsherPrompt(opts: {
  userId: string;
  query: string;
  idea?: IdeaContext | null;
  retrieve?: boolean;
  limit?: number;
}): Promise<AsherPromptResult> {
  const instructions = await instructionBlock(opts.userId, "chat");
  const retrieving = opts.retrieve !== false;

  const [hits, operational] = await Promise.all([
    retrieving && opts.query.trim()
      ? retrieveVaultContext({
          userId: opts.userId,
          query: `${opts.query}\n${opts.idea?.title ?? ""}`,
          excludeIdeaId: opts.idea?.id,
          limit: opts.limit ?? 5,
        })
      : Promise.resolve<VaultHit[]>([]),
    retrieving ? retrieveOperationalContext(opts.userId) : Promise.resolve({ todos: [], events: [] }),
  ]);

  const vaultContext = renderVaultContext(hits);
  const operationalContext = renderOperationalContext(operational);
  const ideaContext = opts.idea ? renderIdeaContext(opts.idea) : "";

  const systemPrompt = [
    ASHER_BASE_PROMPT,
    opts.idea ? "Stay focused on the idea in focus below, but use vault context when it connects." : "",
    instructions,
    ideaContext,
    vaultContext,
    operationalContext,
  ]
    .filter((s) => s && s.trim())
    .join("\n\n");

  return { systemPrompt, instructions, vaultContext, ideaContext, operationalContext, hits };
}
