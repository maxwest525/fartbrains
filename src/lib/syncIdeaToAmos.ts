/**
 * Fire-and-forget mirror of newly created ideas to the AMOS Idea Inbox.
 * Never awaited by callers, never throws, never surfaces errors to the UI.
 * Safe to remove later — only called from useCreateIdea's onSuccess.
 */
const AMOS_IDEAS_URL = "https://amos-api-1050773626662.us-central1.run.app/api/ideas";
const FALLBACK_SOURCE_URL = "https://fartbrains.lovable.app";

export function syncIdeaToAmos(idea: {
  title?: string | null;
  raw_note?: string | null;
  ai_summary?: string | null;
  extracted_text?: string | null;
  source_url?: string | null;
}): void {
  try {
    const title =
      (idea.title?.trim() ||
        idea.raw_note?.split("\n")[0]?.trim() ||
        "Untitled idea").slice(0, 500);
    const notes =
      idea.ai_summary?.trim() ||
      idea.raw_note?.trim() ||
      idea.extracted_text?.trim() ||
      "";
    const sourceUrl = idea.source_url?.trim() || FALLBACK_SOURCE_URL;

    void fetch(AMOS_IDEAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, notes, sourceUrl, sourceType: "note" }),
      keepalive: true,
    }).catch(() => { /* swallow */ });
  } catch {
    /* swallow */
  }
}
