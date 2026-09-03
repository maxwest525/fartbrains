import { guardAiRequest } from "../_shared/ai-guard.ts";
/**
 * Deep research — Firecrawl web search (with on-the-fly scraping) feeding a
 * Gemini synthesis prompt. Returns a cited markdown report plus the raw
 * source list so the caller can save both.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Source = { url: string; title: string; snippet: string; markdown: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await guardAiRequest(req, corsHeaders, "deep_research");
  if ("response" in _guard) return _guard.response;
  const _auth = { user: _guard.user };

  try {
    const { query, context, limit } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Query is too short" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // 1) Web search + scrape via Firecrawl
    const fcRes = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: query.trim(),
        limit: Math.max(3, Math.min(8, Number(limit) || 5)),
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });

    if (!fcRes.ok) {
      const body = await fcRes.text();
      throw new Error(`Firecrawl search failed (${fcRes.status}): ${body.slice(0, 200)}`);
    }
    const fc = await fcRes.json();
    // v2 returns { success, data: { web: [...] } } OR { data: [...] } depending on endpoint
    const rawResults: any[] = Array.isArray(fc?.data)
      ? fc.data
      : Array.isArray(fc?.data?.web)
        ? fc.data.web
        : [];

    const sources: Source[] = rawResults
      .map((r) => ({
        url: r.url ?? r.metadata?.sourceURL ?? "",
        title: r.title ?? r.metadata?.title ?? r.url ?? "Untitled",
        snippet: (r.description ?? r.metadata?.description ?? "").slice(0, 240),
        markdown: (r.markdown ?? "").slice(0, 8000),
      }))
      .filter((s) => s.url);

    if (sources.length === 0) {
      return new Response(JSON.stringify({ error: "No search results returned" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Synthesis via Lovable AI Gateway (Gemini)
    const sourcesBlock = sources
      .map((s, i) => `### [${i + 1}] ${s.title}\nURL: ${s.url}\n\n${s.markdown || s.snippet}`)
      .join("\n\n---\n\n");

    const system = `You are a rigorous research analyst. Synthesize the supplied web sources into a clear, structured markdown brief. Rules:
- Cite sources inline using bracketed numbers like [1], [2] that match the provided source list.
- Never invent facts. If sources disagree, say so.
- Be concrete: name people, products, numbers, dates from the sources.
- Output in this exact markdown shape:

**TL;DR:** 1-2 sentences capturing the answer.

**Key findings:** 4-7 bullets, each with at least one [n] citation.

**Notable quotes / data:** 2-4 short pulled lines with citations.

**Open questions:** 2-3 follow-ups worth chasing.

**Sources:** numbered list mapping [n] → title — URL.`;

    const userPrompt = `Research question: ${query.trim()}${
      context ? `\n\nAdditional context from the user's idea:\n${String(context).slice(0, 2000)}` : ""
    }\n\nSources to synthesize from:\n\n${sourcesBlock}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const body = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in your workspace billing." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`AI synthesis failed (${aiRes.status}): ${body.slice(0, 200)}`);
    }
    const ai = await aiRes.json();
    const report = ai?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!report) throw new Error("Empty synthesis returned");

    return new Response(
      JSON.stringify({
        report,
        sources: sources.map((s, i) => ({ n: i + 1, url: s.url, title: s.title })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
