import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
import { guardAiRequest } from "../_shared/ai-guard.ts";
/**
 * Extract Instagram Reel/Post metadata: caption, author, thumbnail.
 * No login or audio transcription — pure HTML/OG-tag scrape with a couple of fallbacks.
 *
 * Strategy:
 *   1. Validate URL is on instagram.com.
 *   2. Fetch the public page HTML with a desktop UA.
 *   3. Pull og:title / og:description / og:image / author from meta tags.
 *   4. Return a normalized payload the client uses to build an idea draft.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Payload = {
  /** Caption / description text we'll feed into summarize. */
  text: string;
  /** Best title we could find. */
  title: string | null;
  /** Author handle when discoverable. */
  author: string | null;
  /** og:image when available. */
  thumbnail: string | null;
  /** Final canonical URL. */
  url: string;
};

const META_RE = (prop: string) =>
  new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    "i"
  );

const ALT_META_RE = (prop: string) =>
  new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i"
  );

const pickMeta = (html: string, prop: string): string | null => {
  const m = html.match(META_RE(prop)) ?? html.match(ALT_META_RE(prop));
  return m ? decodeHtmlEntities(m[1]) : null;
};

const decodeHtmlEntities = (s: string): string =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");

/** Pull "@handle" or display name out of og:title like "Jane on Instagram: ..." */
const extractAuthor = (ogTitle: string | null): string | null => {
  if (!ogTitle) return null;
  const m = ogTitle.match(/^(.+?)\s+on Instagram[:\s]/i);
  return m ? m[1].trim() : null;
};

/** Pull caption from og:title — Instagram puts it after the colon. */
const extractCaption = (ogTitle: string | null, ogDesc: string | null): string => {
  if (ogTitle) {
    const m = ogTitle.match(/on Instagram[:\s]*["“]?(.+?)["”]?$/i);
    if (m && m[1].trim().length > 0) return m[1].trim();
  }
  return ogDesc?.trim() ?? "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await guardAiRequest(req, corsHeaders, "extract_instagram");
  if ("response" in _guard) return _guard.response;
  const _auth = { user: _guard.user };

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return jsonErr("URL required", 400);
    }

    let target: URL;
    try {
      target = new URL(url);
    } catch {
      return jsonErr("Invalid URL", 400);
    }

    if (!/(^|\.)instagram\.com$/i.test(target.hostname)) {
      return jsonErr("URL must be an instagram.com link", 400);
    }

    const resp = await fetch(target.toString(), {
      headers: {
        // Desktop Chrome UA — Instagram serves a richer OG-tagged page than to bots.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    if (!resp.ok) {
      return jsonErr(`Couldn't load Instagram page (${resp.status})`, 422);
    }

    const html = await resp.text();

    const ogTitle = pickMeta(html, "og:title");
    const ogDesc = pickMeta(html, "og:description");
    const ogImage = pickMeta(html, "og:image");
    const ogUrl = pickMeta(html, "og:url");

    const author = extractAuthor(ogTitle);
    const caption = extractCaption(ogTitle, ogDesc);

    if (!caption) {
      return jsonErr(
        "No public caption found. The post may be private, deleted, or login-walled.",
        422
      );
    }

    const titleGuess = author
      ? `Instagram — ${author}`
      : "Instagram post";

    const payload: Payload = {
      text: caption,
      title: titleGuess,
      author,
      thumbnail: ogImage ?? null,
      url: ogUrl ?? target.toString(),
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-instagram error:", e);
    return jsonErr(e instanceof Error ? e.message : "Unknown error", 500);
  }
});

function jsonErr(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
