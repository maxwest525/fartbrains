/**
 * Resolve an Instagram Reel/Post URL to its underlying video, then transcribe it.
 *
 * Pipeline:
 *   1. Validate it's an instagram.com URL.
 *   2. Run Apify's `apify/instagram-scraper` actor synchronously (run-sync-get-dataset-items)
 *      to get the direct CDN videoUrl + caption + author.
 *   3. Download the video bytes (Apify returns a short-lived CDN URL).
 *   4. Send the audio to ElevenLabs Scribe (`scribe_v2`) for transcription.
 *   5. Return { transcript, caption, author, title, thumbnail, videoUrl, finalUrl }.
 *
 * Required secrets:
 *   - APIFY_API_TOKEN     (Apify personal API token)
 *   - ELEVENLABS_API_KEY  (ElevenLabs API key with STT enabled)
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

// Apify actor that handles reels, posts and stories and returns direct media URLs.
const APIFY_ACTOR_ID = "shu8hvrXbJbY3Eb9W"; // apify/instagram-scraper

// Cap downloaded media to keep memory + ElevenLabs costs sane (≈ 5–6 min reel).
const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50 MB

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
    if (!/(^|\.)instagram\.com$/i.test(target.hostname)) {
      return json({ error: "URL must be an instagram.com link" }, 400);
    }

    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) return json({ error: "APIFY_API_TOKEN not configured" }, 500);

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) return json({ error: "ELEVENLABS_API_KEY not configured" }, 500);

    // 1) Resolve via Apify (sync) — returns dataset items directly.
    const apifyUrl =
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items` +
      `?token=${encodeURIComponent(APIFY_API_TOKEN)}`;

    const apifyResp = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [target.toString()],
        resultsType: "posts",
        resultsLimit: 1,
        addParentData: false,
      }),
    });

    if (!apifyResp.ok) {
      const t = await apifyResp.text();
      console.error("Apify error", apifyResp.status, t);
      return json(
        { error: `Couldn't fetch Instagram media (Apify ${apifyResp.status})` },
        502,
      );
    }

    const items = (await apifyResp.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(items) || items.length === 0) {
      return json(
        { error: "No data returned for this Instagram URL. It may be private or removed." },
        422,
      );
    }

    const item = items[0];
    const videoUrl = pickString(item, ["videoUrl", "videoUrlBackup"]);
    const caption = pickString(item, ["caption"]) ?? "";
    const author =
      pickString(item, ["ownerUsername"]) ??
      pickString(item, ["ownerFullName"]) ??
      null;
    const thumbnail = pickString(item, ["displayUrl", "thumbnailUrl"]) ?? null;
    const finalUrl = pickString(item, ["url"]) ?? target.toString();

    if (!videoUrl) {
      return json(
        {
          error:
            "This post has no video to transcribe (image-only post, story expired, or audio-less reel).",
          caption,
          author,
          thumbnail,
          finalUrl,
        },
        422,
      );
    }

    // 2) Download the media bytes from Apify's CDN URL.
    const mediaResp = await fetch(videoUrl);
    if (!mediaResp.ok) {
      return json({ error: `Couldn't download reel (${mediaResp.status})` }, 502);
    }
    const contentLengthHeader = mediaResp.headers.get("content-length");
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_MEDIA_BYTES) {
      return json(
        { error: "Reel is too large to transcribe (over 50MB). Try a shorter clip." },
        413,
      );
    }
    const mediaBuffer = await mediaResp.arrayBuffer();
    if (mediaBuffer.byteLength > MAX_MEDIA_BYTES) {
      return json(
        { error: "Reel is too large to transcribe (over 50MB). Try a shorter clip." },
        413,
      );
    }

    // 3) Send the file straight to ElevenLabs Scribe.
    // Scribe accepts video files directly and pulls the audio track.
    const sttForm = new FormData();
    sttForm.append(
      "file",
      new Blob([mediaBuffer], { type: mediaResp.headers.get("content-type") ?? "video/mp4" }),
      "reel.mp4",
    );
    sttForm.append("model_id", "scribe_v2");
    sttForm.append("tag_audio_events", "false");
    sttForm.append("diarize", "false");

    const sttResp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: sttForm,
    });

    if (!sttResp.ok) {
      const t = await sttResp.text();
      console.error("ElevenLabs error", sttResp.status, t);
      // Still return the caption so the user gets *something* useful.
      return json(
        {
          error: `Transcription failed (${sttResp.status}). Caption returned instead.`,
          transcript: "",
          caption,
          author,
          thumbnail,
          videoUrl,
          finalUrl,
          title: author ? `Instagram — ${author}` : "Instagram reel",
        },
        200,
      );
    }

    const sttData = (await sttResp.json()) as { text?: string; language_code?: string };
    const transcript = (sttData.text ?? "").trim();

    return json({
      transcript,
      language: sttData.language_code ?? null,
      caption,
      author,
      thumbnail,
      videoUrl,
      finalUrl,
      title: author ? `Instagram — ${author}` : "Instagram reel",
    });
  } catch (e) {
    console.error("transcribe-instagram error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}
