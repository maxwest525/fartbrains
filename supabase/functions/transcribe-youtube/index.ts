import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
import { guardAiRequest } from "../_shared/ai-guard.ts";
import { SttError, checkAudioLimits, resolveSttConfig, transcribeAudio } from "../_shared/stt.ts";
import {
  completeJob,
  createJob,
  failJob,
  lookupTranscript,
  storeTranscript,
} from "../_shared/transcripts.ts";
/**
 * Transcribe a YouTube video.
 *
 * Cheapest source first, because a speech model is the most expensive thing
 * this product does:
 *   1) Shared transcript cache — free. Two customers saving the same video pay
 *      for it once, ever.
 *   2) Captions via Apify actor `starvibe/youtube-video-transcript` — near-free.
 *   3) Only then: download the audio and pay a speech model, via the shared
 *      STT config (see _shared/stt.ts).
 *
 * Quota reserved for steps 1 and 2 is refunded — the customer is only charged
 * an AI action when we actually paid a provider.
 *
 * Required secrets:
 *   - APIFY_API_TOKEN
 *   - LOVABLE_API_KEY or ELEVENLABS_API_KEY, per STT_PROVIDER
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await guardAiRequest(req, corsHeaders, "transcribe_youtube");
  if ("response" in _guard) return _guard.response;
  const _auth = { user: _guard.user };

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
    if (!APIFY_API_TOKEN) return json({ error: "Transcription isn't available right now." }, 503);
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // 0) Cache — free, and the single biggest saving available here.
    const cached = await lookupTranscript("youtube", videoId);
    if (cached) {
      await _guard.refund("cache_hit");
      return json({
        transcript: cached.transcript,
        title: cached.title ?? "YouTube video",
        author: cached.author,
        thumbnail,
        videoUrl: null,
        finalUrl: canonicalUrl,
        durationSeconds: cached.durationSeconds,
        caption: "",
        resolvedFrom: "cache",
      });
    }

    const jobId = await createJob(_auth.user.id, "youtube", canonicalUrl, videoId);

    // 1) Captions — near-free, so this is also refunded.
    const captioned = await tryCaptions(canonicalUrl, APIFY_API_TOKEN);
    if (captioned) {
      await storeTranscript("youtube", videoId, {
        transcript: captioned.transcript,
        title: captioned.title ?? null,
        author: captioned.author ?? null,
        durationSeconds: null,
        source: "captions",
      });
      await completeJob(jobId, "captions", {
        transcript: captioned.transcript,
        title: captioned.title,
        author: captioned.author,
        thumbnail,
      });
      await _guard.refund("no_cost_source");
      return json({
        transcript: captioned.transcript,
        title: captioned.title ?? "YouTube video",
        author: captioned.author,
        thumbnail,
        videoUrl: null,
        finalUrl: canonicalUrl,
        durationSeconds: null,
        caption: "",
        resolvedFrom: "captions",
      });
    }

    // 2) Paid path. This is the only branch that costs an AI action.
    console.log("transcribe-youtube: no captions, falling back to audio for", videoId);
    const cfg = resolveSttConfig(Deno.env.toObject());

    let audio: { bytes: Uint8Array; mime: string; title?: string | null; durationSeconds?: number | null };
    try {
      audio = await downloadAudio(canonicalUrl, APIFY_API_TOKEN);
    } catch (e) {
      await failJob(jobId, "audio_download_failed");
      await _guard.refund("failed_before_spend");
      console.error("transcribe-youtube: audio download failed", e instanceof Error ? e.message : e);
      return json({ error: "Couldn't get the audio for this video." }, 502);
    }

    const overLimit = checkAudioLimits(cfg, audio.bytes.byteLength, audio.durationSeconds ?? null);
    if (overLimit) {
      await failJob(jobId, overLimit.code);
      await _guard.refund("failed_before_spend");
      return json({ error: overLimit.message, code: overLimit.code }, 413);
    }

    let stt;
    try {
      stt = await transcribeAudio(audio.bytes, audio.mime, Deno.env.toObject());
    } catch (e) {
      const code = e instanceof SttError ? e.code : "stt_failed";
      await failJob(jobId, code);
      await _guard.record({ success: false, errorCode: code });
      console.error("transcribe-youtube: stt failed", code);
      return json({ error: "Couldn't transcribe this video. Try again in a moment.", code }, 502);
    }

    await storeTranscript("youtube", videoId, {
      transcript: stt.text,
      title: audio.title ?? null,
      author: null,
      durationSeconds: audio.durationSeconds ?? null,
      source: "stt",
      provider: stt.provider,
      model: stt.model,
    });
    await completeJob(jobId, "stt", {
      transcript: stt.text,
      title: audio.title,
      thumbnail,
      durationSeconds: audio.durationSeconds,
    });
    await _guard.record({
      success: true,
      provider: stt.provider,
      model: stt.model,
      inputUnits: audio.durationSeconds ?? null,
      outputUnits: stt.text.length,
    });

    return json({
      transcript: stt.text,
      title: audio.title ?? "YouTube video",
      author: null,
      thumbnail,
      videoUrl: null,
      finalUrl: canonicalUrl,
      durationSeconds: audio.durationSeconds,
      caption: "",
      resolvedFrom: "stt",
    });
  } catch (e) {
    console.error("transcribe-youtube error:", e);
    return json({ error: "Something went wrong transcribing that video." }, 500);
  }
});
