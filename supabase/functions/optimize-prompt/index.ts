const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Prompt Optimizer
 *
 * Takes a user-supplied draft prompt and rewrites it into a clearer, more
 * structured prompt optimized for a specific target LLM. We call the Lovable
 * AI Gateway with `google/gemini-2.5-flash` (fast, cheap, capable).
 *
 * Body:
 *   { draft: string, targetModel?: string, audience?: string }
 *
 * Response:
 *   { optimized: string }
 */

const SYSTEM = `You are a senior prompt engineer. You rewrite a user's draft prompt so it
performs reliably on a specific target LLM.

Rules:
- Preserve the user's original intent. Do not invent new requirements.
- Output ONLY the rewritten prompt. No preamble, no explanation, no markdown
  fences, no headings like "Optimized prompt:".
- Use the structure best suited to the target model:
    * GPT-5 / GPT-5.2 family: Markdown sections (Role, Task, Context, Constraints,
      Output format). Concise.
    * Gemini family: Clear role + task + context + explicit output format.
    * Claude family: Use XML tags <role> <task> <context> <constraints>
      <output_format> when helpful.
    * Generic / unknown: Markdown sections.
- Always include: a clear role, the task, any context the user supplied, hard
  constraints, and the desired output format. If the user didn't supply
  something, infer a sensible default and keep it short.
- Keep it tight. No filler. No "as an AI" disclaimers.`;

type Body = {
  draft?: unknown;
  targetModel?: unknown;
  audience?: unknown;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const draft = typeof body.draft === "string" ? body.draft.trim() : "";
    const targetModel =
      typeof body.targetModel === "string" && body.targetModel.trim()
        ? body.targetModel.trim()
        : "Generic / any LLM";
    const audience =
      typeof body.audience === "string" && body.audience.trim()
        ? body.audience.trim()
        : "";

    if (draft.length < 10) {
      return new Response(
        JSON.stringify({ error: "Draft prompt is too short (min 10 chars)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (draft.length > 8000) {
      return new Response(
        JSON.stringify({ error: "Draft prompt is too long (max 8000 chars)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userMsg = [
      `Target model: ${targetModel}`,
      audience ? `Audience / use case notes: ${audience}` : null,
      "",
      "Draft prompt:",
      draft,
    ]
      .filter(Boolean)
      .join("\n");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (r.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit reached. Try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (r.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable settings." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!r.ok) {
      const txt = await r.text();
      return new Response(
        JSON.stringify({ error: `AI gateway error: ${txt.slice(0, 300)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await r.json();
    const optimized: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!optimized) {
      return new Response(
        JSON.stringify({ error: "AI returned an empty response. Try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Server-side safety net: mirror the client validation. Hard-blocks only —
    // warnings are surfaced to the user and don't fail the request.
    const MIN_LEN = 30;
    const MAX_LEN = 12_000;
    const MAX_LINES = 400;
    const refusalPatterns = [
      /\bas an ai (language )?model\b/i,
      /\bi (?:cannot|can't|won'?t|am unable to)\b/i,
      /\bi(?:'m| am) sorry,? but\b/i,
      /\bi do not have the ability\b/i,
    ];
    const metaPatterns = [
      /^\s*(here'?s|here is)\s+(your|the)\s+(optimized|rewritten|improved)/i,
      /^\s*optimized prompt\s*:/i,
      /^\s*rewritten prompt\s*:/i,
      /^\s*sure[,!.]?\s+here/i,
    ];
    const violations: string[] = [];
    if (optimized.length < MIN_LEN) violations.push(`too short (<${MIN_LEN} chars)`);
    if (optimized.length > MAX_LEN) violations.push(`too long (>${MAX_LEN} chars)`);
    if (optimized.split("\n").length > MAX_LINES) violations.push(`too many lines (>${MAX_LINES})`);
    if (/^\s*```/.test(optimized) && /```\s*$/.test(optimized)) violations.push("wrapped in code fences");
    if (metaPatterns.some((re) => re.test(optimized))) violations.push("contains meta preamble");
    if (refusalPatterns.some((re) => re.test(optimized))) violations.push("contains refusal language");
    if (/(.)\1{49,}/.test(optimized)) violations.push("runaway character repetition");

    if (violations.length > 0) {
      return new Response(
        JSON.stringify({
          error: `AI output failed safety checks: ${violations.join(", ")}. Try again.`,
          violations,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ optimized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
