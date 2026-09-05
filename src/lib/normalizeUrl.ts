// Normalize a URL for duplicate detection.
//
// Strips protocol, "www.", mobile subdomains, tracking params, fragments and
// trailing slashes; lowercases the host; sorts the remaining query so the same
// link pasted twice matches. Keeps the path and meaningful params, so two
// different posts on one site are never collapsed.
//
// The share sheet is how most material arrives, and it hands over whichever
// URL shape the source app happens to use — so the same video reaches us as
// youtu.be/ID from a phone and youtube.com/watch?v=ID from a desktop, and the
// same Instagram post arrives under /reel/, /reels/ or /p/. Those are folded
// to one canonical form below. Without it the duplicate warning simply never
// fired on the most common capture path, which is the one place it matters.

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "fbclid", "gclid", "igshid", "igsh", "si", "feature", "ref", "ref_src",
  "ref_url", "_r", "share_id", "lang", "yclid", "msclkid", "twclid",
  "mc_cid", "mc_eid",
]);

/** Hosts where "m." or "mobile." is the same site, not a different one. */
const MOBILE_PREFIX = /^(m|mobile)\./;

const YOUTUBE_HOSTS = new Set(["youtube.com", "youtu.be", "youtube-nocookie.com"]);

/**
 * Fold a known host's many URL shapes into one. Returns null when the URL is
 * not one of the special cases, so everything else falls through untouched —
 * over-normalizing would collapse genuinely different pages.
 */
function canonicalize(host: string, path: string, params: URLSearchParams): { path: string; params: URLSearchParams } | null {
  if (YOUTUBE_HOSTS.has(host)) {
    // youtu.be/<id> and /watch?v=<id> and /shorts/<id> and /embed/<id> are
    // all the same video. Everything but the id is presentation.
    let id: string | null = null;
    if (host === "youtu.be") id = path.slice(1).split("/")[0] || null;
    else if (path === "/watch") id = params.get("v");
    else {
      const m = /^\/(?:shorts|embed|live|v)\/([^/]+)/.exec(path);
      if (m) id = m[1];
    }
    if (id) {
      const next = new URLSearchParams();
      next.set("v", id);
      return { path: "/watch", params: next };
    }
    return null;
  }

  if (host === "instagram.com") {
    // Instagram serves one post under all three of these.
    const m = /^\/(?:reel|reels|p)\/([^/]+)/.exec(path);
    if (m) return { path: `/p/${m[1]}`, params: new URLSearchParams() };
    return null;
  }

  return null;
}

export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  // A bare word parses as a URL with no dot in the host; that is a search
  // term, not a link, and treating it as one produces phantom duplicates.
  if (!u.hostname.includes(".")) return null;

  let host = u.hostname.toLowerCase().replace(/^www\./, "");
  host = host.replace(MOBILE_PREFIX, "");

  const kept = new URLSearchParams();
  Array.from(u.searchParams.entries())
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, v]) => kept.append(k, v));

  let path = u.pathname.replace(/\/+$/, "");
  if (path === "") path = "/";

  const canonical = canonicalize(host, path, kept);
  if (canonical) {
    if (host === "youtu.be" || host === "youtube-nocookie.com") host = "youtube.com";
    path = canonical.path;
    const qs = canonical.params.toString();
    return `${host}${path}${qs ? `?${qs}` : ""}`;
  }

  const qs = kept.toString();
  return `${host}${path}${qs ? `?${qs}` : ""}`;
}
