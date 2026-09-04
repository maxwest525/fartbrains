import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
import { guardAiRequest } from "../_shared/ai-guard.ts";
import { instructionBlock } from "../_shared/instructions.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Turns a captured idea into a prompt. Two shapes:
 *
 *  - mode "paste" (default): a short prompt the user drops into ChatGPT/Claude.
 *    This is what the idea detail page has always produced; unchanged.
 *
 *  - mode "build": a build brief for an agent that already sits inside the
 *    user's project and has their filesystem. It gets the stack, the existing
 *    context we hold, and an explicit build loop, because the caller is not a
 *    person copy-pasting — it is an agent that is about to do the work.
 *
 * Returns plain text (no markdown wrapping) so the copy-paste is clean.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await guardAiRequest(req, corsHeaders, "generate_prompt");
  if ("response" in _guard) return _guard.response;
  const _auth = { user: _guard.user };

  try {
    const { title, note, summary, extractedText, sourceUrl, sourceLabel, mode, stack, context } =
      await req.json();
    const buildMode = mode === "build";

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

    const pasteSystemPrompt = `You craft prompts that the user will paste into another AI assistant (ChatGPT, Claude, Gemini, etc.) to act on an idea they've captured.

Rules:
- Output ONLY the prompt text. No preamble, no quotes, no markdown fences.
- Write in second person to the target AI ("You are...", "Help me...").
- Open with a short role/persona line tailored to the idea.
- The user's note is the PRIMARY intent — what they actually want done. Lead with it.
- Use the AI summary for high-level framing and the extracted text for specific quotes/details/examples worth referencing.
- Distill, don't dump — never paste the full extracted text or summary verbatim.
- End with 2-4 numbered deliverables the AI should produce.
- Keep it under ~300 words. Plain text. No emojis.`;

    const buildSystemPrompt = `You write build briefs. The reader is a coding agent already working inside the user's own project, with their filesystem and their stack in front of it. It is going to build the thing. It is not a person reading advice.

The captured material is usually someone on a video or in an article demonstrating a technique, a workflow, or an agent they built. Your job is to turn that demonstration into something buildable for THIS user's project.

Rules:
- Output ONLY the brief. No preamble, no quotes, no markdown fences.
- Open with one sentence naming what gets built and what it is for.
- Then "What the source actually does:" — the mechanism, concretely. Steps, order, the specific tactic. If the source is vague or is mostly claims, say so plainly rather than inventing detail; a brief that oversells a thin source is worse than a short one.
- Then "Build this:" — numbered, in dependency order, each step something the agent can act on without asking a question. Name files, commands, or endpoints where the material supports it.
- Then "Adapt to this project:" — how it changes given the stack and existing context below. If the stack is unknown, say what the agent should check first.
- Then "Verify:" — how to tell it actually works. Not "test it" — the specific observable outcome.
- Then "Do not:" — the one or two things that would make this unsafe, expensive, or wrong to install. Include anything the source glosses over that touches credentials, third-party code, data exfiltration, or spend.
- Improve on the source where you can, and mark those lines "(improvement, not from the source)" so the agent can tell what came from the material and what came from you.
- Distill, never dump the transcript.
- Under ~600 words. Plain text. No emojis.`;

    const systemPrompt = buildMode ? buildSystemPrompt : pasteSystemPrompt;
    const userRules = await instructionBlock(_auth.user.id, "chat");
    const finalSystemPrompt = userRules ? `${systemPrompt}\n\n${userRules}` : systemPrompt;

    const parts: string[] = [];
    if (title) parts.push(`Title of the idea: ${String(title).slice(0, 200)}`);
    if (sourceLabel) parts.push(`Source type: ${String(sourceLabel).slice(0, 60)}`);
    if (sourceUrl) parts.push(`Source URL: ${String(sourceUrl).slice(0, 500)}`);
    if (hasNote) parts.push(`User's own note (their intent / what they want done — PRIMARY):\n${String(note).slice(0, 4000)}`);
    if (hasSummary) parts.push(`AI summary of the source material:\n${String(summary).slice(0, 8000)}`);
    if (hasExtracted) parts.push(`Raw extracted text / transcript (use for specific details, do not dump verbatim):\n${String(extractedText).slice(0, 12000)}`);
    if (buildMode && typeof stack === "string" && stack.trim())
      parts.push(`The project this is being built into (stack, framework, constraints):\n${stack.trim().slice(0, 2000)}`);
    if (buildMode && typeof context === "string" && context.trim())
      parts.push(`Related material this user has already saved (for continuity — reuse what they already decided, do not contradict it):\n${context.trim().slice(0, 8000)}`);

    const userPrompt = buildMode
      ? `Write a build brief from the following captured idea.\n\n${parts.join("\n\n")}`
      : `Build a ready-to-paste prompt from the following captured idea.\n\n${parts.join("\n\n")}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: finalSystemPrompt },
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
