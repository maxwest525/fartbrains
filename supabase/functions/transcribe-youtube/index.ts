/**
 * Transcribe a YouTube video.
 *
 * Strategy:
 *   1) Try captions via Apify actor `starvibe/youtube-video-transcript` (fast, cheap).
 *   2) If no captions, download the audio via Apify actor
 *      `epicscrapers/youtube-audio-downloader` and transcribe it with
 *      ElevenLabs Scribe (`scribe_v1`).
 *
 * Required secrets:
 *   - APIFY_API_TOKEN
 *   - ELEVENLABS_API_KEY  (only needed for the audio fallback)
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

const CAPTION_ACTOR_ID = "Uwpce1RSXlrzF6WBA"; // starvibe/youtube-video-transcript
const AUDIO_ACTOR_ID = "epicscrapers~youtube-audio-downloader";

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

/** Try the caption-based path. Returns transcript string, or null if unavailable. */
async function tryCaptions(
  videoUrl: string,
  apifyToken: string,
): Promise<{ transcript: string; title: string | null; author: string | null } | null> {
  const url =
    `https://api.apify.com/v2/acts/${CAPTION_ACTOR_ID}/run-sync-get-dataset-items` +
    `?token=${encodeURIComponent(apifyToken)}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ youtube_url: videoUrl }),
  });
  if (!resp.ok) {
    console.error("caption actor http", resp.status, (await resp.text()).slice(0, 300));
    return null;
  }
  const items = (await resp.json()) as Array<Record<string, unknown>>;
  if (!Array.isArray(items) || items.length === 0) return null;

  const chunks: string[] = [];
  let title: string | null = null;
  let author: string | null = null;
  const collect = (v: unknown) => {
    if (!v) return;
    if (typeof v === "string") chunks.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.text === "string") chunks.push(o.text);
      else if (typeof o.transcript === "string") chunks.push(o.transcript);
      else if (Array.isArray(o.transcript)) collect(o.transcript);
      else if (Array.isArray(o.data)) collect(o.data);
      else if (Array.isArray(o.segments)) collect(o.segments);
    }
  };
  for (const it of items) {
    const o = it as Record<string, unknown>;
    title ??= (typeof o.title === "string" ? o.title : null) ?? (typeof o.videoTitle === "string" ? o.videoTitle : null);
    author ??= (typeof o.author === "string" ? o.author : null) ?? (typeof o.channelName === "string" ? o.channelName : null) ?? (typeof o.channel === "string" ? o.channel : null);
    collect(o.transcript ?? o.data ?? o.segments ?? o.text ?? o);
  }
  const transcript = chunks.join(" ").replace(/\s+/g, " ").trim();
  const looksLikeError =
    /^ERROR[:\s]/i.test(transcript) ||
    /ERROR:\s*\d{4}-\d{2}-\d{2}/i.test(transcript) ||
    /caption (api|is) (returning empty|not available)/i.test(transcript);
  if (looksLikeError || !transcript || transcript.length < 5) return null;
  return { transcript, title, author };
}

/** Download audio via Apify, return { bytes, mime, title }. */
async function downloadAudio(
  videoUrl: string,
  apifyToken: string,
): Promise<{ bytes: Uint8Array; mime: string; title: string | null; durationSeconds: number | null }> {
  // run-sync returns the full run object so we can grab KV store id
  const runUrl =
    `https://api.apify.com/v2/acts/${AUDIO_ACTOR_ID}/run-sync` +
    `?token=${encodeURIComponent(apifyToken)}`;
  const runResp = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startUrls: [videoUrl], audioFormat: "mp3" }),
  });
  if (!runResp.ok) {
    throw new Error(`Audio downloader failed (${runResp.status}): ${(await runResp.text()).slice(0, 300)}`);
  }
  const run = (await runResp.json()) as { data?: { defaultKeyValueStoreId?: string; defaultDatasetId?: string } };
  const kvId = run.data?.defaultKeyValueStoreId;
  const dsId = run.data?.defaultDatasetId;
  if (!kvId || !dsId) throw new Error("Audio downloader: missing store ids in run response");

  const dsResp = await fetch(
    `https://api.apify.com/v2/datasets/${dsId}/items?clean=true&format=json&token=${encodeURIComponent(apifyToken)}`,
  );
  const items = (await dsResp.json()) as Array<Record<string, unknown>>;
  const first = items?.[0];
  if (!first) throw new Error("Audio downloader returned no items");
  if (first.status && first.status !== "downloaded") {
    throw new Error(`Audio downloader status: ${String(first.status)}`);
  }
  const kvKey = String(first.kv_store_key ?? "");
  if (!kvKey) throw new Error("Audio downloader: missing kv_store_key");

  const audioResp = await fetch(
    `https://api.apify.com/v2/key-value-stores/${kvId}/records/${encodeURIComponent(kvKey)}?token=${encodeURIComponent(apifyToken)}`,
  );
  if (!audioResp.ok) throw new Error(`Couldn't fetch audio file (${audioResp.status})`);
  const buf = new Uint8Array(await audioResp.arrayBuffer());
  const mime = audioResp.headers.get("content-type") ?? "audio/mpeg";

  return {
    bytes: buf,
    mime,
    title: typeof first.video_title === "string" ? first.video_title : null,
    durationSeconds: typeof first.duration === "number" ? first.duration : null,
  };
}

async function transcribeWithElevenLabs(bytes: Uint8Array, mime: string, elevenKey: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: mime }), "audio.mp3");
  fd.append("model_id", "scribe_v1");
  // language auto-detect; no diarize needed
  const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": elevenKey },
    body: fd,
  });
  if (!resp.ok) {
    throw new Error(`ElevenLabs Scribe failed (${resp.status}): ${(await resp.text()).slice(0, 300)}`);
  }
  const data = (await resp.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  if (!text) throw new Error("ElevenLabs returned no transcript text");
  return text;
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
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

    // 1) Captions path
    const captioned = await tryCaptions(canonicalUrl, APIFY_API_TOKEN);
    if (captioned) {
      return json({
        transcript: captioned.transcript,
        title: captioned.title ?? "YouTube video",
        author: captioned.author,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        videoUrl: null,
        finalUrl: canonicalUrl,
        durationSeconds: null,
        caption: "",
      });
    }

    // 2) Audio fallback via ElevenLabs Scribe
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) {
      return json(
        { error: "This video has no captions and ELEVENLABS_API_KEY isn't configured for audio fallback." },
        422,
      );
    }

    console.log("transcribe-youtube: no captions, falling back to audio for", videoId);
    const audio = await downloadAudio(canonicalUrl, APIFY_API_TOKEN);
    const transcript = await transcribeWithElevenLabs(audio.bytes, audio.mime, ELEVENLABS_API_KEY);

    return json({
      transcript,
      title: audio.title ?? "YouTube video",
      author: null,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      videoUrl: null,
      finalUrl: canonicalUrl,
      durationSeconds: audio.durationSeconds,
      caption: "",
    });
  } catch (e) {
    console.error("transcribe-youtube error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
