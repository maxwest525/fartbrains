import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text, kind } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length < 20) {
      return new Response(JSON.stringify({ error: "Text too short to summarize" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are an idea-capture assistant. Read the input and produce a clear, useful summary in markdown with these sections:

**Main idea:** one or two sentences capturing the core point.

**Key points:** 3-6 concise bullets.

**Action items:** bullets with possible next steps. If none apply, write "None".

**Suggested title:** a short 3-8 word title for this idea.

Be concise. Do not invent details that aren't in the source.`;

    const userPrompt =
      kind === "webpage"
        ? `The following is text extracted from a webpage. Summarize it.\n\n---\n${text.slice(0, 60000)}`
        : kind === "transcript"
          ? `The following is a transcript or pasted text from a video/social post. Summarize it.\n\n---\n${text.slice(0, 60000)}`
          : `Summarize the following.\n\n---\n${text.slice(0, 60000)}`;

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
