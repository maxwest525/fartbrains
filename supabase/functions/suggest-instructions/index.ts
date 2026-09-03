import { guardAiRequest } from "../_shared/ai-guard.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Drafts personal-instruction suggestions by reading patterns out of the user's
// own vault (folders, tags, note style). Read-only: never writes instructions.
// The client decides what to accept, merge, or discard.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Suggestions = {
  general: string;
  capture: string;
  summarize: string;
  tagging: string;
  organizing: string;
};

const EMPTY: Suggestions = {
  general: "",
  capture: "",
  summarize: "",
  tagging: "",
  organizing: "",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await guardAiRequest(req, corsHeaders, "suggest_instructions");
  if ("response" in _guard) return _guard.response;
  const _auth = { user: _guard.user };

  try {
    const body = await req.json().catch(() => ({}));
    const existing = (body?.existing ?? {}) as Partial<Suggestions>;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const [{ data: ideas }, { data: folders }] = await Promise.all([
      svc
        .from("ideas")
        .select("title, tags, raw_note, ai_summary, folder_id, created_at")
        .eq("user_id", _auth.user.id)
        .order("updated_at", { ascending: false })
        .limit(120),
      svc.from("folders").select("id, name").eq("user_id", _auth.user.id),
    ]);

    const folderNames = new Map<string, string>(
      (folders ?? []).map((f) => [String(f.id), String(f.name)]),
    );
    const rows = (ideas ?? []).map((r) => ({
      ...r,
      folder: r.folder_id ? folderNames.get(String(r.folder_id)) ?? null : null,
    }));
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ suggestions: EMPTY, sampleCount: 0, ideaCount: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tagCounts = new Map<string, number>();
    const folderCounts = new Map<string, number>();
    for (const r of rows) {
      for (const t of Array.isArray(r.tags) ? r.tags : []) {
        const k = String(t).toLowerCase();
        tagCounts.set(k, (tagCounts.get(k) ?? 0) + 1);
      }
      const f = String(r.folder ?? "").trim();
      if (f) folderCounts.set(f, (folderCounts.get(f) ?? 0) + 1);
    }
    const top = (m: Map<string, number>, n: number) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => `${k} (${c})`);

    const sample = rows.slice(0, 40).map((r, i) => {
      const note = String(r.raw_note ?? r.ai_summary ?? "").replace(/\s+/g, " ").slice(0, 220);
      return `${i + 1}. [${r.folder ?? "no folder"}] ${r.title ?? "(untitled)"}${
        Array.isArray(r.tags) && r.tags.length ? ` {${r.tags.join(", ")}}` : ""
      }${note ? ` — ${note}` : ""}`;
    });

    const systemPrompt = `You infer a person's working style from their idea vault and draft their personal instructions for an AI second brain.
Return STRICT JSON only, no markdown, with exactly these keys: general, capture, summarize, tagging, organizing.
Each value: 2-5 short imperative lines written in the FIRST PERSON as the user's own standing rules ("Keep summaries to 3 bullets."). No preamble, no headings.
Ground every rule in observable evidence from the vault (real tag names, real folder names, actual note length and tone). Never invent facts about the person.
If the user already wrote a rule for a field, keep their wording and only extend it with what the vault clearly shows.`;

    const userPrompt = [
      `Vault size: ${rows.length} ideas.`,
      `Top tags: ${top(tagCounts, 15).join(", ") || "none"}`,
      `Folders in use: ${top(folderCounts, 10).join(", ") || "none"}`,
      "",
      "Existing instructions the user already wrote (may be blank):",
      JSON.stringify({ ...EMPTY, ...existing }, null, 2),
      "",
      "Sample of recent ideas:",
      ...sample,
    ].join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit hit. Try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      console.error("suggest-instructions gateway error", resp.status, await resp.text());
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const raw = String(json?.choices?.[0]?.message?.content ?? "{}");
    let parsed: Partial<Suggestions> = {};
    try {
      parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
    } catch (_e) {
      parsed = {};
    }

    const suggestions: Suggestions = {
      general: String(parsed.general ?? "").trim(),
      capture: String(parsed.capture ?? "").trim(),
      summarize: String(parsed.summarize ?? "").trim(),
      tagging: String(parsed.tagging ?? "").trim(),
      organizing: String(parsed.organizing ?? "").trim(),
    };

    return new Response(
      JSON.stringify({ suggestions, sampleCount: sample.length, ideaCount: rows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("suggest-instructions error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
