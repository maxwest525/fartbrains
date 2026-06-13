// Extract specific recommendations from an idea and resolve each to one URL.
// Uses Lovable AI to detect items, Firecrawl search for the URL, with an
// AI-only "best guess" fallback if Firecrawl isn't available.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ExtractedItem = {
  name: string;
  kind: string;
  query: string;
  description?: string;
};

// Generic platforms we don't want to surface when mentioned in passing.
const SKIP_NAMES = new Set(
  [
    "google", "chatgpt", "claude", "github", "youtube", "twitter", "x",
    "reddit", "facebook", "instagram", "tiktok", "linkedin", "wikipedia",
    "gmail", "notion", "slack", "discord", "microsoft", "apple", "openai",
    "anthropic", "meta", "amazon",
  ].map((s) => s.toLowerCase()),
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { ideaId } = await req.json().catch(() => ({}));
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
    const userId = userData.user.id;

    const { data: idea, error: ideaErr } = await userClient
      .from("ideas")
      .select("id, title, raw_note, extracted_text, ai_summary")
      .eq("id", ideaId)
      .maybeSingle();
    if (ideaErr) return json({ error: ideaErr.message }, 500);
    if (!idea) return json({ error: "Idea not found" }, 404);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI key missing" }, 500);

    // ---- 1. LLM extraction ----------------------------------------------
    const sourceBlock = [
      `TITLE: ${idea.title ?? ""}`,
      idea.ai_summary ? `SUMMARY:\n${idea.ai_summary}` : "",
      idea.extracted_text
        ? `SOURCE TEXT:\n${String(idea.extracted_text).slice(0, 8000)}`
        : "",
      idea.raw_note ? `NOTE:\n${String(idea.raw_note).slice(0, 2000)}` : "",
    ].filter(Boolean).join("\n\n");

    const systemPrompt = `You scan a note and pull out SPECIFIC things the author recommends, mentions favorably, or tells the reader to check out (tools, apps, products, GitHub repos, websites, books, papers, channels, videos).

STRICT RULES:
- Only include items that are the SPECIFIC subject of a recommendation. Skip anything mentioned only in passing.
- NEVER include these generic platforms on their own: Google, ChatGPT, Claude, GitHub, YouTube, Twitter/X, Reddit, Facebook, Instagram, TikTok, LinkedIn, Wikipedia, Gmail, Notion, Slack, Discord, Microsoft, Apple, OpenAI, Anthropic, Meta, Amazon. ("I asked ChatGPT" → skip. "Try Claude Sonnet 4.5 for code" → keep as "Claude Sonnet 4.5".)
- For a specific item HOSTED on one of those platforms (a particular repo, channel, video, subreddit), keep it — but \`name\` and \`query\` must include the unique identifier (e.g. name: "LibreChat", query: "LibreChat github repo"). Never just "github" or "youtube".
- Cap at 8 distinct items. Quality over quantity. Return [] if nothing specific.
- \`kind\` is one of: github_repo, tool, product, site, book, channel, video, paper, other.
- \`query\` should be the exact search string a person would type to find the official page (include the kind word when helpful, e.g. "Obsidian app", "Attention Is All You Need paper").

Respond with ONLY valid JSON of shape:
{"items":[{"name":"...","kind":"...","query":"...","description":"<=120 chars optional"}]}
No prose, no markdown fences.`;

    const extractResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: sourceBlock || "(empty idea)" },
          ],
        }),
      },
    );

    if (!extractResp.ok) {
      const t = await extractResp.text();
      console.error("extract AI error", extractResp.status, t);
      if (extractResp.status === 429) return json({ error: "Rate limit" }, 429);
      if (extractResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
      return json({ error: "AI extract failed" }, 500);
    }

    const extractData = await extractResp.json();
    const rawContent: string = extractData?.choices?.[0]?.message?.content ?? "";
    const items = parseItems(rawContent).filter((it) => {
      const n = it.name.trim().toLowerCase();
      return n && !SKIP_NAMES.has(n);
    }).slice(0, 8);

    // ---- 2. Resolve each item to one URL --------------------------------
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    const resolved: Array<{
      name: string;
      url: string;
      title: string | null;
      description: string | null;
      kind: string;
      source: "firecrawl" | "ai_guess";
    }> = [];

    for (const item of items) {
      let url: string | null = null;
      let title: string | null = null;
      let description: string | null = item.description ?? null;
      let source: "firecrawl" | "ai_guess" = "firecrawl";

      if (FIRECRAWL_API_KEY) {
        try {
          const fc = await fetch("https://api.firecrawl.dev/v2/search", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: item.query, limit: 1 }),
          });
          if (fc.ok) {
            const fcData = await fc.json();
            const first = pickFirstResult(fcData);
            if (first?.url) {
              url = first.url;
              title = first.title ?? null;
              description = description ?? first.description ?? null;
            }
          } else {
            console.warn("firecrawl status", fc.status, await fc.text());
          }
        } catch (e) {
          console.warn("firecrawl error", e);
        }
      }

      if (!url) {
        // AI fallback — ask for the single most likely official URL.
        const guess = await aiGuessUrl(LOVABLE_API_KEY, item);
        if (guess) {
          url = guess;
          source = "ai_guess";
        }
      }

      if (url) {
        resolved.push({
          name: item.name,
          url,
          title,
          description,
          kind: item.kind || "other",
          source,
        });
      }
    }

    // ---- 3. Replace existing rows --------------------------------------
    await userClient.from("idea_references").delete().eq("idea_id", ideaId);

    if (resolved.length > 0) {
      const rows = resolved.map((r, i) => ({
        user_id: userId,
        idea_id: ideaId,
        name: r.name,
        url: r.url,
        title: r.title,
        description: r.description,
        kind: r.kind,
        source: r.source,
        position: i,
      }));
      const { error: insErr } = await userClient.from("idea_references").insert(rows);
      if (insErr) {
        console.error("insert references error", insErr);
        return json({ error: insErr.message }, 500);
      }
    }

    return json({ count: resolved.length, references: resolved });
  } catch (e) {
    console.error("extract-references error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function parseItems(raw: string): ExtractedItem[] {
  const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
  let parsed: { items?: ExtractedItem[] } = {};
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
  return (parsed.items ?? []).filter(
    (it) => it && typeof it.name === "string" && typeof it.query === "string",
  );
}

function pickFirstResult(d: unknown): { url: string; title?: string; description?: string } | null {
  if (!d || typeof d !== "object") return null;
  const obj = d as Record<string, unknown>;
  // v2 returns { data: { web: [...] } } or { data: [...] }
  const data = obj.data as Record<string, unknown> | unknown[] | undefined;
  const arr =
    Array.isArray(data)
      ? data
      : Array.isArray((data as Record<string, unknown>)?.web)
      ? ((data as Record<string, unknown>).web as unknown[])
      : Array.isArray(obj.web)
      ? (obj.web as unknown[])
      : [];
  const first = arr[0] as Record<string, unknown> | undefined;
  if (!first) return null;
  const url = (first.url ?? first.link) as string | undefined;
  if (!url) return null;
  return {
    url,
    title: (first.title as string) ?? undefined,
    description: (first.description ?? first.snippet) as string | undefined,
  };
}

async function aiGuessUrl(
  apiKey: string,
  item: ExtractedItem,
): Promise<string | null> {
  try {
    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content:
                'Return ONLY a single URL — the most likely official website, GitHub repo, or canonical page for the item. No prose, no quotes, no markdown. If you are not reasonably confident, return the literal word NONE.',
            },
            {
              role: "user",
              content: `Item: ${item.name}\nKind: ${item.kind}\nQuery: ${item.query}`,
            },
          ],
        }),
      },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const raw: string = (data?.choices?.[0]?.message?.content ?? "").trim();
    if (!raw || raw.toUpperCase().startsWith("NONE")) return null;
    const m = raw.match(/https?:\/\/[^\s)"']+/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
