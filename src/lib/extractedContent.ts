/**
 * Normalize the raw responses from our URL extractor edge functions into a
 * single shape the UI can consume without caring about platform specifics.
 *
 * Sources today:
 *   - extract-url           (web pages)            → { title, text, siteName }
 *   - transcribe-instagram  (Instagram reels/posts) → { transcript, caption, author, thumbnail, finalUrl, title, videoUrl }
 *
 * If we add TikTok / YouTube transcribers later they should also produce a
 * `NormalizedExtraction` so the preview card and save flow stay untouched.
 */

export type NormalizedSourceKind = "instagram" | "tiktok" | "youtube" | "webpage";

export type NormalizedExtraction = {
  /** Final canonical URL (after redirects when known). */
  url: string;
  /** Best-guess title for the idea — never empty (falls back to host). */
  suggestedTitle: string;
  /** Body text the user reviews / edits before summarizing. */
  text: string;
  /** Which extractor produced this. Drives icon, source_type, copy. */
  sourceKind: NormalizedSourceKind;
  /** Optional author / handle, when the platform exposes one. */
  author: string | null;
  /** Optional preview thumbnail. */
  thumbnail: string | null;
  /** Optional site/app name (e.g. "The Verge", "Instagram"). */
  siteName: string | null;
  /** Whether the body text came from machine transcription vs. on-page text. */
  hasTranscript: boolean;
};

const safeHost = (raw: string): string => {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return raw;
  }
};

const truncateTitle = (s: string, max = 200): string =>
  s.trim().replace(/\s+/g, " ").slice(0, max);

/** Pull a usable string off a record, trying each key in order. */
const pickStr = (obj: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
};

/**
 * Convert an Instagram extractor payload into the shared shape.
 * Combines transcript + caption into a single readable body so the preview
 * editor stays a single textarea like the web flow.
 */
const fromInstagram = (raw: Record<string, unknown>, fallbackUrl: string): NormalizedExtraction => {
  const transcript = pickStr(raw, ["transcript"]) ?? "";
  const caption = pickStr(raw, ["caption"]) ?? "";
  const author = pickStr(raw, ["author"]);
  const thumbnail = pickStr(raw, ["thumbnail"]);
  const url = pickStr(raw, ["finalUrl", "url"]) ?? fallbackUrl;
  const titleRaw =
    pickStr(raw, ["title"]) ??
    (author ? `Instagram — ${author}` : "Instagram post");

  const text =
    transcript && caption
      ? `${transcript}\n\n— Caption —\n${caption}`
      : transcript || caption;

  return {
    url,
    suggestedTitle: truncateTitle(titleRaw),
    text,
    sourceKind: "instagram",
    author,
    thumbnail,
    siteName: "Instagram",
    hasTranscript: transcript.length > 0,
  };
};

/** Convert a generic web extractor payload into the shared shape. */
const fromWebpage = (raw: Record<string, unknown>, fallbackUrl: string): NormalizedExtraction => {
  const text = pickStr(raw, ["text"]) ?? "";
  const url = pickStr(raw, ["finalUrl", "url"]) ?? fallbackUrl;
  const siteName = pickStr(raw, ["siteName"]);
  const titleRaw =
    pickStr(raw, ["title"]) ??
    siteName ??
    safeHost(url);

  return {
    url,
    suggestedTitle: truncateTitle(titleRaw),
    text,
    sourceKind: "webpage",
    author: null,
    thumbnail: pickStr(raw, ["thumbnail", "image"]),
    siteName,
    hasTranscript: false,
  };
};

/**
 * Public entrypoint: hand it the raw edge-function payload and the platform
 * we routed to, and get back a uniform `NormalizedExtraction`.
 *
 * Throws when there's nothing usable in the payload — callers convert this
 * into a toast. Empty-text cases are surfaced as errors here so the UI never
 * has to defensively re-check.
 */
export function normalizeExtraction(
  sourceKind: NormalizedSourceKind,
  raw: unknown,
  fallbackUrl: string,
): NormalizedExtraction {
  if (!raw || typeof raw !== "object") {
    throw new Error("Extractor returned no data");
  }
  const obj = raw as Record<string, unknown>;
  const normalized =
    sourceKind === "instagram"
      ? fromInstagram(obj, fallbackUrl)
      : fromWebpage(obj, fallbackUrl);

  if (!normalized.text || normalized.text.trim().length === 0) {
    throw new Error("Couldn't extract any readable text from this URL");
  }
  return normalized;
}
