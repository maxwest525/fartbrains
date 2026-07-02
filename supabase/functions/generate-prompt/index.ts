import { requireUser } from "../_shared/user-auth.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Combines a user's raw note with the AI summary of the source material into a
 * single, ready-to-paste prompt the user can drop into ChatGPT/Claude/etc.
 * Returns plain text (no markdown wrapping) so the copy-paste is clean.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _auth = await requireUser(req, corsHeaders);
  if ("response" in _auth) return _auth.response;

  try {
    const { title, note, summary, extractedText, sourceUrl, sourceLabel } = await req.json();

    const hasNote = typeof note === "string" && note.trim().length > 0;
    const hasSummary = typeof summary === "string" && summary.trim().length > 0;
    const hasExtracted = typeof extractedText === "string" && extractedText.trim().length > 0;
    if (!hasNote && !hasSummary && !hasExtracted) {
      return new Response(
        JSON.stringify({ error: "Need a note, summary, or extracted text to generate a prompt." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You craft prompts that the user will paste into another AI assistant (ChatGPT, Claude, Gemini, etc.) to act on an idea they've captured.

Rules:
- Output ONLY the prompt text. No preamble, no quotes, no markdown fences.
- Write in second person to the target AI ("You are...", "Help me...").
- Open with a short role/persona line tailored to the idea.
- The user's note is the PRIMARY intent — what they actually want done. Lead with it.
- Use the AI summary for high-level framing and the extracted text for specific quotes/details/examples worth referencing.
- Distill, don't dump — never paste the full extracted text or summary verbatim.
- End with 2-4 numbered deliverables the AI should produce.
- Keep it under ~300 words. Plain text. No emojis.`;

    const parts: string[] = [];
    if (title) parts.push(`Title of the idea: ${String(title).slice(0, 200)}`);
    if (sourceLabel) parts.push(`Source type: ${String(sourceLabel).slice(0, 60)}`);
    if (sourceUrl) parts.push(`Source URL: ${String(sourceUrl).slice(0, 500)}`);
    if (hasNote) parts.push(`User's own note (their intent / what they want done — PRIMARY):\n${String(note).slice(0, 4000)}`);
    if (hasSummary) parts.push(`AI summary of the source material:\n${String(summary).slice(0, 8000)}`);
    if (hasExtracted) parts.push(`Raw extracted text / transcript (use for specific details, do not dump verbatim):\n${String(extractedText).slice(0, 12000)}`);

    const userPrompt = `Build a ready-to-paste prompt from the following captured idea.\n\n${parts.join("\n\n")}`;

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
          JSON.stringify({ error: "AI credits exhausted. Add credits in your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Prompt generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const prompt: string = (data?.choices?.[0]?.message?.content ?? "").trim();
    if (!prompt) throw new Error("Empty response from AI");

    return new Response(JSON.stringify({ prompt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-prompt error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
