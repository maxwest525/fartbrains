/**
 * Transcribe a YouTube video using Apify's youtube-transcript-scraper actor.
 *
 * Pipeline:
 *   1. Validate URL.
 *   2. Run `pintostudio/youtube-transcript-scraper` synchronously.
 *   3. Concatenate transcript segments → return text.
 *
 * If the video has no captions, return a 422 with a clear message — we
 * intentionally do NOT attempt to download YouTube audio (YouTube blocks
 * direct downloads and no reliable Apify-only path exists).
 *
 * Required secrets:
 *   - APIFY_API_TOKEN
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// pintostudio/youtube-transcript-scraper
const APIFY_ACTOR_ID = "faVsWy9VTSNVIhWpR";

const isYouTubeHost = (host: string): boolean => {
  const h = host.toLowerCase();
  return (
    h === "youtube.com" ||
    h === "www.youtube.com" ||
    h === "m.youtube.com" ||
    h === "music.youtube.com" ||
    h === "youtu.be"
  );
};

function extractVideoId(u: URL): string | null {
  if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  const v = u.searchParams.get("v");
  if (v) return v;
  const m = u.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url || typeof url !== "string") return json({ error: "URL required" }, 400);

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return json({ error: "Invalid URL" }, 400);
    }
    if (!isYouTubeHost(target.hostname)) {
      return json({ error: "URL must be a youtube.com or youtu.be link" }, 400);
    }
    if (target.pathname.startsWith("/playlist")) {
      return json({ error: "Playlists aren't supported — paste a single video URL." }, 400);
    }

    const videoId = extractVideoId(target);
    if (!videoId) return json({ error: "Couldn't parse a video ID from that URL." }, 400);

    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) return json({ error: "APIFY_API_TOKEN not configured" }, 500);

    const apifyUrl =
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items` +
      `?token=${encodeURIComponent(APIFY_API_TOKEN)}`;

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const apifyResp = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: canonicalUrl }),
    });

    if (!apifyResp.ok) {
      const t = await apifyResp.text();
      console.error("Apify error", apifyResp.status, t.slice(0, 500));
      return json(
        { error: `Couldn't fetch transcript (Apify ${apifyResp.status})` },
        502,
      );
    }

    const items = (await apifyResp.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(items) || items.length === 0) {
      return json(
        { error: "This video has no captions available to transcribe." },
        422,
      );
    }

    // The actor returns either:
    //   - one item with `data: [{ text, start, dur }, ...]` and a `title`
    //   - or an array of segment items each with `text`
    let transcript = "";
    let title: string | null = null;
    let author: string | null = null;

    const first = items[0];
    if (Array.isArray((first as Record<string, unknown>).data)) {
      const segs = (first as Record<string, unknown>).data as Array<Record<string, unknown>>;
      transcript = segs
        .map((s) => (typeof s.text === "string" ? s.text : ""))
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      title = (first.title as string) ?? null;
      author = (first.author as string) ?? (first.channelName as string) ?? null;
    } else {
      transcript = items
        .map((s) => (typeof s.text === "string" ? s.text : ""))
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    if (!transcript || transcript.length < 5) {
      return json(
        { error: "This video has no captions available to transcribe." },
        422,
      );
    }

    return json({
      transcript,
      title: title ?? "YouTube video",
      author,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      videoUrl: null,
      finalUrl: canonicalUrl,
      durationSeconds: null,
      caption: "",
    });
  } catch (e) {
    console.error("transcribe-youtube error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
