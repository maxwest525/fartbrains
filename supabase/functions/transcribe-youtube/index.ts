/**
 * Resolve a YouTube URL to its underlying media via Apify, then transcribe
 * the audio with ElevenLabs Scribe.
 *
 * Pipeline:
 *   1. Validate it's a youtube.com / youtu.be URL (no playlists).
 *   2. Run an Apify YouTube downloader actor synchronously to obtain a direct
 *      media URL + metadata (title, channel, thumbnail, duration).
 *   3. Reject videos longer than MAX_DURATION_SECONDS to bound transcription cost.
 *   4. Download the media bytes (capped at 50 MB).
 *   5. Send to ElevenLabs Scribe (scribe_v2) for transcription.
 *   6. Return { transcript, caption, author, title, thumbnail, videoUrl, finalUrl }.
 *
 * Required secrets:
 *   - APIFY_API_TOKEN     (Apify personal API token)
 *   - ELEVENLABS_API_KEY  (ElevenLabs API key with STT enabled)
 *
 * Optional override:
 *   - APIFY_YOUTUBE_ACTOR_ID  (defaults to streamers/youtube-video-downloader)
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

// Default Apify YouTube downloader actor. Returns direct mp4 + metadata.
// Swap with APIFY_YOUTUBE_ACTOR_ID env var if you prefer another actor.
const DEFAULT_ACTOR_ID = "streamers~youtube-video-downloader";

// 30 min hard cap — keeps ElevenLabs cost predictable & fits edge fn timeout.
const MAX_DURATION_SECONDS = 30 * 60;
const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50 MB

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
    if (target.pathname.startsWith("/playlist") || target.searchParams.get("list")) {
      // Allow playlist param on single-video URLs only if v= is present.
      if (target.pathname.startsWith("/playlist") || !target.searchParams.get("v")) {
        return json({ error: "Playlists aren't supported — paste a single video URL." }, 400);
      }
    }

    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) return json({ error: "APIFY_API_TOKEN not configured" }, 500);

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) return json({ error: "ELEVENLABS_API_KEY not configured" }, 500);

    const actorId = Deno.env.get("APIFY_YOUTUBE_ACTOR_ID") ?? DEFAULT_ACTOR_ID;

    // 1) Resolve via Apify.
    const apifyUrl =
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items` +
      `?token=${encodeURIComponent(APIFY_API_TOKEN)}`;

    const apifyResp = await fetch(apifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Most YouTube actors accept one of these — send both for compatibility.
        startUrls: [{ url: target.toString() }],
        videoUrls: [target.toString()],
        urls: [target.toString()],
        maxResults: 1,
        downloadVideo: true,
        includeVideoUrl: true,
      }),
    });

    if (!apifyResp.ok) {
      const t = await apifyResp.text();
      console.error("Apify error", apifyResp.status, t);
      return json(
        { error: `Couldn't fetch YouTube media (Apify ${apifyResp.status}). Make sure the actor is enabled.` },
        502,
      );
    }

    const items = (await apifyResp.json()) as Array<Record<string, unknown>>;
    if (!Array.isArray(items) || items.length === 0) {
      return json(
        { error: "No data returned for this YouTube URL. The video may be private, age-restricted, or removed." },
        422,
      );
    }

    const item = items[0];
    const videoUrl = pickString(item, [
      "downloadUrl",
      "videoUrl",
      "mediaUrl",
      "audioUrl",
      "mp4Url",
      "downloadLink",
      "url",
    ]);
    const title = pickString(item, ["title", "videoTitle", "name"]) ?? "YouTube video";
    const author =
      pickString(item, ["channelName", "channel", "author", "uploader", "ownerChannelName"]) ?? null;
    const thumbnail = pickString(item, ["thumbnail", "thumbnailUrl", "image"]) ?? null;
    const finalUrl = pickString(item, ["url", "videoUrl"]) ?? target.toString();
    const duration = pickNumber(item, ["duration", "durationSeconds", "lengthSeconds", "videoDuration"]);

    if (duration && duration > MAX_DURATION_SECONDS) {
      return json(
        {
          error: `Video is too long (${Math.round(duration / 60)} min). Max ${MAX_DURATION_SECONDS / 60} min.`,
        },
        422,
      );
    }

    if (!videoUrl) {
      return json(
        {
          error:
            "Couldn't get a downloadable media URL from this YouTube video. It may be age-restricted, members-only, or live.",
          title,
          author,
          thumbnail,
          finalUrl,
        },
        422,
      );
    }

    // 2) Download media bytes.
    const mediaResp = await fetch(videoUrl);
    if (!mediaResp.ok) {
      return json({ error: `Couldn't download video (${mediaResp.status})` }, 502);
    }
    const contentLengthHeader = mediaResp.headers.get("content-length");
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_MEDIA_BYTES) {
      return json(
        { error: "Video file is too large to transcribe (over 50MB). Try a shorter clip." },
        413,
      );
    }
    const mediaBuffer = await mediaResp.arrayBuffer();
    if (mediaBuffer.byteLength > MAX_MEDIA_BYTES) {
      return json(
        { error: "Video file is too large to transcribe (over 50MB). Try a shorter clip." },
        413,
      );
    }

    // 3) Transcribe via ElevenLabs Scribe.
    const sttForm = new FormData();
    sttForm.append(
      "file",
      new Blob([mediaBuffer], { type: mediaResp.headers.get("content-type") ?? "video/mp4" }),
      "youtube.mp4",
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
      return json(
        {
          error: `Transcription failed (${sttResp.status}).`,
          transcript: "",
          title,
          author,
          thumbnail,
          videoUrl,
          finalUrl,
        },
        200,
      );
    }

    const sttData = (await sttResp.json()) as { text?: string; language_code?: string };
    const transcript = (sttData.text ?? "").trim();

    return json({
      transcript,
      language: sttData.language_code ?? null,
      caption: "",
      title,
      author,
      thumbnail,
      videoUrl,
      finalUrl,
      durationSeconds: duration ?? null,
    });
  } catch (e) {
    console.error("transcribe-youtube error:", e);
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

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
}
