// Smart Connections: ask an LLM to pick the most related ideas to a given idea
// from the user's library. Returns up to 5 matches with short reasons.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type LiteIdea = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ideaId } = await req.json().catch(() => ({}));
    if (!ideaId || typeof ideaId !== "string") {
      return json({ error: "ideaId required" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    // Fetch the target idea + all candidates in one shot (RLS scopes to user).
    const { data: all, error: ideasErr } = await userClient
      .from("ideas")
      .select("id, title, ai_summary, raw_note, tags")
      .order("updated_at", { ascending: false })
      .limit(300);
    if (ideasErr) return json({ error: ideasErr.message }, 500);

    const target = all?.find((i) => i.id === ideaId);
    if (!target) return json({ related: [] });

    const candidates: LiteIdea[] = (all ?? [])
      .filter((i) => i.id !== ideaId)
      .map((i) => ({
        id: i.id,
        title: i.title ?? "",
        summary: (i.ai_summary ?? i.raw_note ?? "").slice(0, 400),
        tags: i.tags ?? [],
      }));

    if (candidates.length === 0) return json({ related: [] });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI key missing" }, 500);

    const targetBlock = [
      `TITLE: ${target.title}`,
      target.ai_summary ? `SUMMARY: ${target.ai_summary.slice(0, 800)}` : "",
      target.tags?.length ? `TAGS: ${target.tags.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const candidateBlock = candidates
      .map(
        (c, idx) =>
          `[${idx}] id=${c.id}\n  title: ${c.title}\n  ${c.summary ? `notes: ${c.summary}` : ""}${c.tags.length ? `\n  tags: ${c.tags.join(", ")}` : ""}`,
      )
      .join("\n\n");

    const systemPrompt = `You connect related notes in a personal idea library. Given a target idea and a list of candidate ideas, pick up to 5 candidates that are MEANINGFULLY related — same topic, complementary insight, contrasting take, useful next step, or shared theme. Skip weak matches; quality over quantity. If nothing is meaningfully related, return an empty array.

Respond with ONLY valid JSON of the shape:
{"related":[{"id":"<uuid>","reason":"<max 12 words explaining the connection>"}]}

No prose, no markdown fences.`;

    const userPrompt = `TARGET IDEA:\n${targetBlock}\n\nCANDIDATES:\n${candidateBlock}`;

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
    let parsed: { related?: { id: string; reason: string }[] } = {};
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = {};
        }
      }
    }

    const validIds = new Set(candidates.map((c) => c.id));
    const related = (parsed.related ?? [])
      .filter((r) => r && typeof r.id === "string" && validIds.has(r.id))
      .slice(0, 5)
      .map((r) => {
        const match = candidates.find((c) => c.id === r.id)!;
        return {
          id: r.id,
          title: match.title,
          reason: String(r.reason ?? "").slice(0, 140),
        };
      });

    return json({ related });
  } catch (e) {
    console.error("related-ideas error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
