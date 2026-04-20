// Normalize a URL for duplicate detection.
// Strips protocol, "www.", tracking params, fragments, and trailing slashes.
// Lowercases host. Keeps the path & meaningful query params so two different
// posts on the same site aren't collapsed.
const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "igshid", "igsh", "si", "feature", "ref", "ref_src",
  "ref_url", "_r", "share_id", "lang",
]);

export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  // Strip tracking params
  const params = new URLSearchParams();
  Array.from(u.searchParams.entries())
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, v]) => params.append(k, v));
  let path = u.pathname.replace(/\/+$/, "");
  if (path === "") path = "/";
  const qs = params.toString();
  return `${host}${path}${qs ? `?${qs}` : ""}`;
}
