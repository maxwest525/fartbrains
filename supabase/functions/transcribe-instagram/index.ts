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
 * Resolve an Instagram Reel/Post URL to its underlying video, then transcribe it.
 *
 * Pipeline:
 *   1. Validate it's an instagram.com URL.
 *   2. Run Apify's `apify/instagram-scraper` actor synchronously (run-sync-get-dataset-items)
 *      to get the direct CDN videoUrl + caption + author.
 *   3. Download the video bytes (Apify returns a short-lived CDN URL).
 *   4. Transcribe via the shared STT config (_shared/stt.ts) — provider and
 *      model are environment-driven, not hardcoded here.
 *   5. Return { transcript, caption, author, title, thumbnail, videoUrl, finalUrl }.
 *
 * Required secrets:
 *   - APIFY_API_TOKEN     (Apify personal API token)
 *   - LOVABLE_API_KEY or ELEVENLABS_API_KEY, depending on STT_PROVIDER
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

// Apify actor that handles reels, posts and stories and returns direct media URLs.
const APIFY_ACTOR_ID = "shu8hvrXbJbY3Eb9W"; // apify/instagram-scraper

// Cap downloaded media to keep memory + ElevenLabs costs sane (≈ 5–6 min reel).
const MAX_MEDIA_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Instagram's own id for a post — the shortcode in /p/<code>/, /reel/<code>/ or
 * /tv/<code>/. It is the cache key, so a link with tracking parameters or a
 * different path prefix still resolves to one cached transcript.
 */
function extractShortcode(u: URL): string | null {
  const m = u.pathname.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await guardAiRequest(req, corsHeaders, "transcribe_instagram");
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
    // Instagram has no captions track to fall back on, so unlike YouTube every
    // reel is a paid transcription. The shared cache is the only cheap source
    // here, which makes checking it before spending anything the whole game.
    if (!/(^|\.)instagram\.com$/i.test(target.hostname)) {
      return json({ error: "URL must be an instagram.com link" }, 400);
    }

    const shortcode = extractShortcode(target);

    // Cache first: free, and the only cheap source this path has.
    if (shortcode) {
      const cached = await lookupTranscript("instagram", shortcode);
      if (cached) {
        await _guard.refund("cache_hit");
        return json({
          transcript: cached.transcript,
          language: null,
          caption: "",
          author: cached.author,
          thumbnail: null,
          videoUrl: null,
          finalUrl: target.toString(),
          title: cached.title ?? (cached.author ? `Instagram — ${cached.author}` : "Instagram reel"),
          resolvedFrom: "cache",
        });
      }
    }

    const jobId = await createJob(_auth.user.id, "instagram", target.toString(), shortcode);

    const APIFY_API_TOKEN = Deno.env.get("APIFY_API_TOKEN");
    if (!APIFY_API_TOKEN) {
      await failJob(jobId, "not_configured");
      await _guard.refund("failed_before_spend");
      return json({ error: "Transcription isn't available right now." }, 503);
    }


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

    // 3) Paid path — the shared STT config decides provider and model.
    const cfg = resolveSttConfig(Deno.env.toObject());
    const mime = mediaResp.headers.get("content-type") ?? "video/mp4";
    const bytes = new Uint8Array(mediaBuffer);

    const overLimit = checkAudioLimits(cfg, bytes.byteLength, null);
    if (overLimit) {
      await failJob(jobId, overLimit.code);
      await _guard.refund("failed_before_spend");
      return json({ error: overLimit.message, code: overLimit.code }, 413);
    }

    let stt;
    try {
      stt = await transcribeAudio(bytes, mime, Deno.env.toObject());
    } catch (e) {
      const code = e instanceof SttError ? e.code : "stt_failed";
      await failJob(jobId, code);
      await _guard.record({ success: false, errorCode: code });
      console.error("transcribe-instagram: stt failed", code);
      // The caption is still worth returning — the user gets something useful.
      return json(
        {
          error: "Couldn't transcribe this reel. The caption is below.",
          code,
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

    const title = author ? `Instagram — ${author}` : "Instagram reel";

    if (shortcode) {
      await storeTranscript("instagram", shortcode, {
        transcript: stt.text,
        title,
        author,
        durationSeconds: null,
        source: "stt",
        provider: stt.provider,
        model: stt.model,
      });
    }
    await completeJob(jobId, "stt", { transcript: stt.text, title, author, thumbnail });
    await _guard.record({
      success: true,
      provider: stt.provider,
      model: stt.model,
      outputUnits: stt.text.length,
    });

    return json({
      transcript: stt.text,
      language: null,
      caption,
      author,
      thumbnail,
      videoUrl,
      finalUrl,
      title,
      resolvedFrom: "stt",
    });
  } catch (e) {
    console.error("transcribe-instagram error:", e);
    return json({ error: "Something went wrong transcribing that reel." }, 500);
  }
});

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}
