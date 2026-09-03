import { guardAiRequest } from "../_shared/ai-guard.ts";
import { instructionBlock } from "../_shared/instructions.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await guardAiRequest(req, corsHeaders, "auto_tag");
  if ("response" in _guard) return _guard.response;
  const _auth = { user: _guard.user };

  try {
    const { title, text } = await req.json();
    const body = `${title ?? ""}\n\n${(text ?? "").slice(0, 8000)}`.trim();
    if (body.length < 8) {
      return new Response(JSON.stringify({ tags: [], reasoning: "", confidence: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const system = `You auto-tag captured ideas/notes to make them findable and clusterable.
Return ONLY a compact JSON object:
{"tags":["foo","bar"],"confidence":0.0-1.0,"reasoning":"one short sentence explaining the picks"}

Rules:
- 2 to 5 tags total.
- Each tag is 1-2 words, lowercase, kebab-case if multi-word (e.g. "cold-email").
- Prefer SPECIFIC concrete topics, tools, people, frameworks, or domains over generic words like "idea", "note", "thing", "video", "interesting".
- Avoid duplicates and avoid restating the title verbatim.
- "confidence" reflects how clearly the content maps to those tags (0.0 = guess, 1.0 = obvious).
- "reasoning" is ≤ 140 chars, plain English, no markdown.
- If the content is too thin to tag meaningfully, return {"tags":[],"confidence":0,"reasoning":"too thin"}.`;

    const userRules = await instructionBlock(_auth.user.id, "tagging");
    const systemPrompt = userRules
      ? `${system}\n\n${userRules}\n\nThe user's tagging rules override the generic rules above, but ALWAYS keep the JSON output shape.`
      : system;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("auto-tag gateway error:", resp.status, t);
      return new Response(JSON.stringify({ tags: [], reasoning: "", confidence: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let tags: string[] = [];
    let reasoning = "";
    let confidence = 0;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.tags)) {
        tags = parsed.tags
          .filter((t: unknown) => typeof t === "string")
          .map((t: string) =>
            t.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 32)
          )
          .filter((t: string) => t.length >= 2 && t.length <= 32);
        tags = [...new Set(tags)].slice(0, 5);
      }
      if (typeof parsed?.reasoning === "string") reasoning = parsed.reasoning.slice(0, 240);
      if (typeof parsed?.confidence === "number") {
        confidence = Math.max(0, Math.min(1, parsed.confidence));
      }
    } catch (_e) { /* ignore */ }

    return new Response(JSON.stringify({ tags, reasoning, confidence }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-tag error:", e);
    return new Response(JSON.stringify({ tags: [], reasoning: "", confidence: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
