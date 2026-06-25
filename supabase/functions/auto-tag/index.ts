const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { title, text } = await req.json();
    const body = `${title ?? ""}\n\n${(text ?? "").slice(0, 8000)}`.trim();
    if (body.length < 8) {
      return new Response(JSON.stringify({ tags: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const system = `You auto-tag captured ideas/notes to make them findable and clusterable.
Return ONLY a compact JSON object like: {"tags":["foo","bar","baz"]}.
Rules:
- 2 to 5 tags total.
- Each tag is 1-2 words, lowercase, kebab-case if multi-word (e.g. "cold-email").
- Prefer SPECIFIC concrete topics, tools, people, frameworks, or domains over generic words like "idea", "note", "thing", "video", "interesting".
- Avoid duplicates and avoid restating the title verbatim.
- If the content is too thin to tag meaningfully, return {"tags":[]}.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: system },
          { role: "user", content: body },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("auto-tag gateway error:", resp.status, t);
      return new Response(JSON.stringify({ tags: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let tags: string[] = [];
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
    } catch (_e) { /* ignore */ }

    return new Response(JSON.stringify({ tags }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-tag error:", e);
    return new Response(JSON.stringify({ tags: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
