import { requireUser } from "../_shared/user-auth.ts";
/**
 * Firecrawl-powered URL scrape. Returns clean markdown + an AI summary the
 * caller can append to an idea. Use this when you have a specific URL (vs.
 * deep-research which searches first).
 */

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
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let normalized: string;
    try {
      normalized = new URL(url.trim()).toString();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY missing");

    const fcRes = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: normalized,
        formats: ["markdown", "summary"],
        onlyMainContent: true,
      }),
    });

    if (!fcRes.ok) {
      const body = await fcRes.text();
      if (fcRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "Firecrawl credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Scrape failed (${fcRes.status}): ${body.slice(0, 200)}`);
    }

    const fc = await fcRes.json();
    const data = fc?.data ?? fc;
    const markdown: string = (data?.markdown ?? "").toString();
    const summary: string = (data?.summary ?? "").toString();
    const title: string =
      data?.metadata?.title ?? data?.metadata?.ogTitle ?? normalized;

    if (!markdown && !summary) {
      throw new Error("Scrape returned no content");
    }

    return new Response(
      JSON.stringify({ url: normalized, title, markdown, summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
