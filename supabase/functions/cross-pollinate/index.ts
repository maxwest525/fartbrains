// Cross-pollinate: pick a random other idea from the user's library and
// propose a creative, useful connection — how could that idea (or its angle)
// act as a solution, accelerator, or unlock for the current one?
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ideaId, excludeIds = [] } = await req.json().catch(() => ({}));
    if (!ideaId || typeof ideaId !== "string") {
      return json({ error: "ideaId required" }, 400);
    }

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: all, error: ideasErr } = await userClient
      .from("ideas")
      .select("id, title, ai_summary, raw_note, tags")
      .order("updated_at", { ascending: false })
      .limit(300);
    if (ideasErr) return json({ error: ideasErr.message }, 500);

    const target = all?.find((i) => i.id === ideaId);
    if (!target) return json({ suggestion: null });

    const excludeSet = new Set<string>([ideaId, ...excludeIds]);
    const pool = (all ?? []).filter((i) => !excludeSet.has(i.id));
    if (pool.length === 0) return json({ suggestion: null });

    // Random pick — the whole point is the unexpected angle.
    const pick = pool[Math.floor(Math.random() * pool.length)];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI key missing" }, 500);

    const targetBlock = [
      `TITLE: ${target.title ?? ""}`,
      target.ai_summary ? `SUMMARY: ${String(target.ai_summary).slice(0, 800)}` : "",
      target.raw_note && !target.ai_summary ? `NOTE: ${String(target.raw_note).slice(0, 600)}` : "",
      target.tags?.length ? `TAGS: ${target.tags.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const pickBlock = [
      `TITLE: ${pick.title ?? ""}`,
      pick.ai_summary ? `SUMMARY: ${String(pick.ai_summary).slice(0, 600)}` : "",
      pick.raw_note && !pick.ai_summary ? `NOTE: ${String(pick.raw_note).slice(0, 400)}` : "",
      pick.tags?.length ? `TAGS: ${pick.tags.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are a sharp lateral-thinking creative partner inside a personal idea library. You will be given a CURRENT idea the user is looking at, and a RANDOM other idea from their library. Propose ONE concrete way the random idea could act as a solution, unlock, accelerator, missing piece, or unexpected angle for the current idea — even if the connection is loose. Be specific, opinionated, and useful. No hedging, no "could potentially". 2-4 short sentences max.

Respond with ONLY valid JSON:
{"headline":"<max 10 words, the punchy connection>","suggestion":"<2-4 sentence concrete suggestion>"}

No prose outside JSON, no markdown fences.`;

    const userPrompt = `CURRENT IDEA:\n${targetBlock}\n\nRANDOM IDEA FROM LIBRARY:\n${pickBlock}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      if (resp.status === 429) return json({ error: "Rate limit, try again shortly" }, 429);
      if (resp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI request failed" }, 500);
    }

    const data = await resp.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: { headline?: string; suggestion?: string } = {};
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = {}; } }
    }

    return json({
      suggestion: {
        connectedId: pick.id,
        connectedTitle: pick.title ?? "Untitled",
        headline: String(parsed.headline ?? "Unexpected connection").slice(0, 120),
        body: String(parsed.suggestion ?? "").slice(0, 800),
      },
    });
  } catch (e) {
    console.error("cross-pollinate error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
