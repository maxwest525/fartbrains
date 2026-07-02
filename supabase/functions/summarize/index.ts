import { requireUser } from "../_shared/user-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _auth = await requireUser(req, corsHeaders);
  if ("response" in _auth) return _auth.response;

  try {
    const { text, kind, userNote } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Text too short to summarize" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userNoteClean =
      typeof userNote === "string" && userNote.trim().length > 0
        ? userNote.trim().slice(0, 4000)
        : "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const transcriptSystemPrompt = `You are an idea-capture assistant summarizing a spoken transcript (often from a reel, podcast, or short video). The raw text may be messy: filler words, false starts, missing punctuation, ASR errors. Look past the noise and capture the actual substance.

Produce a clean markdown summary with EXACTLY these sections, in this order:

**TL;DR:** one tight sentence (max ~25 words) that captures the single most useful takeaway. Lead with the insight, not "the speaker says".

**Key points:** 3-5 bullets. Each bullet is a complete, self-contained insight a reader can use without watching the source. No filler, no "they mention that…". Prefer concrete claims, frameworks, numbers, or examples from the transcript.

**Action items:** 2-4 bullets phrased as imperatives the listener could actually do ("Audit your…", "Try X for one week", "Stop doing Y"). If the transcript is purely informational with no applicable actions, write "None".

**Suggested title:** 4-8 words. Specific and descriptive — name the actual topic or claim, not the format. Bad: "Instagram Reel Summary", "Marketing Tips". Good: "Cold DM Framework For B2B SaaS", "Why Most Habit Trackers Fail". No quotes, no trailing punctuation, no emoji.

Rules:
- Never invent facts, numbers, names, or quotes that aren't in the source.
- Drop greetings, sign-offs, and self-promotion.
- If the transcript is too short or incoherent to summarize, say so plainly in TL;DR and leave other sections minimal.`;

    const defaultSystemPrompt = `You are an idea-capture assistant. Read the input and produce a clear, useful summary in markdown with these sections:

**Main idea:** one or two sentences capturing the core point.

**Key points:** 3-6 concise bullets.

**Action items:** bullets with possible next steps. If none apply, write "None".

**Suggested title:** a short 3-8 word title for this idea.

Be concise. Do not invent details that aren't in the source.`;

    const systemPrompt = kind === "transcript" ? transcriptSystemPrompt : defaultSystemPrompt;

    const baseUserPrompt =
      kind === "webpage"
        ? `The following is text extracted from a webpage. Summarize it.\n\n---\n${text.slice(0, 60000)}`
        : kind === "transcript"
          ? `The following is a raw transcript from a short video or social post. It may include a "— Caption —" section appended at the end with the original post caption — use it as supporting context for the topic and title, but base the summary on the transcript itself.\n\n---\n${text.slice(0, 60000)}`
          : `Summarize the following.\n\n---\n${text.slice(0, 60000)}`;

    // Optional user-supplied note: lets the saver steer angle/title toward what
    // *they* care about, without letting the model invent facts not in the source.
    const userPrompt = userNoteClean
      ? `The reader added their own note about why this matters to them. Use it ONLY to steer focus, framing, and the suggested title. Do NOT treat it as a source of facts and do NOT echo it back verbatim — the summary must still come from the source content below.\n\n--- Reader's note ---\n${userNoteClean}\n\n${baseUserPrompt}`
      : baseUserPrompt;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit hit. Wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI summary failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const summary: string = data?.choices?.[0]?.message?.content ?? "";

    // Try to pull a suggested title out of the markdown
    const titleMatch = summary.match(/\*\*Suggested title:\*\*\s*(.+)/i);
    const suggestedTitle = titleMatch?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null;

    return new Response(JSON.stringify({ summary, suggestedTitle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
