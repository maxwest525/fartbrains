// Related Nodes: hybrid recommender.
// 1) Prefilter the user's library by tag overlap (Jaccard), shared folder,
//    and shared idea_references hosts.
// 2) Send the top ~15 candidates to the LLM to re-rank with a short reason.
// Returns up to 5 results. Quality over quantity — empty array if nothing fits.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type IdeaRow = {
  id: string;
  title: string | null;
  ai_summary: string | null;
  raw_note: string | null;
  tags: string[] | null;
  folder_id: string | null;
};

type ScoredCandidate = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  score: number;
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

    const { data: all, error: ideasErr } = await userClient
      .from("ideas")
      .select("id, title, ai_summary, raw_note, tags, folder_id")
      .order("updated_at", { ascending: false })
      .limit(400);
    if (ideasErr) return json({ error: ideasErr.message }, 500);

    const target = (all ?? []).find((i: IdeaRow) => i.id === ideaId);
    if (!target) return json({ related: [] });

    // Pull reference hosts for everyone in one shot.
    const ids = (all ?? []).map((i: IdeaRow) => i.id);
    const hostsByIdea = new Map<string, Set<string>>();
    if (ids.length) {
      const { data: refs } = await userClient
        .from("idea_references")
        .select("idea_id, url")
        .in("idea_id", ids);
      for (const r of refs ?? []) {
        if (!r?.idea_id || !r?.url) continue;
        let host = "";
        try { host = new URL(r.url).host.replace(/^www\./, ""); } catch { /* ignore */ }
        if (!host) continue;
        if (!hostsByIdea.has(r.idea_id)) hostsByIdea.set(r.idea_id, new Set());
        hostsByIdea.get(r.idea_id)!.add(host);
      }
    }

    const targetTags = new Set((target.tags ?? []).map((t: string) => t.toLowerCase()));
    const targetHosts = hostsByIdea.get(target.id) ?? new Set<string>();
    const targetFolder = target.folder_id;

    const scored: ScoredCandidate[] = (all ?? [])
      .filter((i: IdeaRow) => i.id !== ideaId)
      .map((i: IdeaRow) => {
        const tags = (i.tags ?? []).map((t) => t.toLowerCase());
        const tagSet = new Set(tags);
        // Jaccard on tags.
        let inter = 0;
        for (const t of tagSet) if (targetTags.has(t)) inter += 1;
        const union = new Set([...targetTags, ...tagSet]).size || 1;
        const jaccard = inter / union;

        // Shared folder bonus.
        const folderBonus = targetFolder && i.folder_id === targetFolder ? 0.15 : 0;

        // Shared reference host bonus (capped).
        const hosts = hostsByIdea.get(i.id) ?? new Set<string>();
        let hostHits = 0;
        for (const h of hosts) if (targetHosts.has(h)) hostHits += 1;
        const hostBonus = Math.min(hostHits, 3) * 0.08;

        const score = jaccard + folderBonus + hostBonus;
        return {
          id: i.id,
          title: i.title ?? "",
          summary: (i.ai_summary ?? i.raw_note ?? "").slice(0, 320),
          tags,
          score,
        };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);

    if (scored.length === 0) return json({ related: [] });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI key missing" }, 500);

    const targetBlock = [
      `TITLE: ${target.title ?? ""}`,
      target.ai_summary ? `SUMMARY: ${target.ai_summary.slice(0, 800)}` : "",
      target.tags?.length ? `TAGS: ${target.tags.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const candidateBlock = scored
      .map((c, idx) =>
        `[${idx}] id=${c.id} score=${c.score.toFixed(2)}\n  title: ${c.title}\n  ${c.summary ? `notes: ${c.summary}` : ""}${c.tags.length ? `\n  tags: ${c.tags.join(", ")}` : ""}`,
      ).join("\n\n");

    const systemPrompt = `You connect related nodes in a personal idea library. Candidates were pre-ranked by tag/folder/reference overlap. Re-rank and pick up to 5 that are MEANINGFULLY related — same topic, complementary insight, contrasting take, useful next step, or shared theme. Quality over quantity; return [] if nothing fits.

Respond with ONLY valid JSON:
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
      // Fall back to top scored, no reasons.
      return json({
        related: scored.slice(0, 5).map((c) => ({
          id: c.id, title: c.title, reason: `Shared tags: ${c.tags.slice(0, 3).join(", ") || "—"}`,
        })),
      });
    }

    const data = await resp.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    let parsed: { related?: { id: string; reason: string }[] } = {};
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = {}; } }
    }

    const byId = new Map(scored.map((c) => [c.id, c]));
    const related = (parsed.related ?? [])
      .filter((r) => r && typeof r.id === "string" && byId.has(r.id))
      .slice(0, 5)
      .map((r) => ({
        id: r.id,
        title: byId.get(r.id)!.title,
        reason: String(r.reason ?? "").slice(0, 140),
      }));

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
