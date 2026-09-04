/**
 * Parsing for the PWA Web Share Target.
 *
 * When someone hits Share on an Instagram reel, a YouTube video or an article
 * and picks Fart Brains, the OS hands us up to three fields — `title`, `text`
 * and `url` — and is inconsistent about which one holds the link.
 *
 * Android is the awkward case. Most apps put nothing in `url` at all and send
 * the link inside `text`, often wrapped in words ("Check this out
 * https://... "), and Instagram appends its own trailing blurb. iOS is tidier
 * and usually fills `url`. So we cannot simply read `url` and hope; we look
 * everywhere, in order of how likely the field is to be the real link, and we
 * pull the URL out of surrounding prose rather than requiring the whole field
 * to be one.
 *
 * Anything left over becomes the note, so the user's own framing — the reason
 * they shared it — is not thrown away.
 */

export type ShareTargetParams = {
  title?: string | null;
  text?: string | null;
  url?: string | null;
};

export type ParsedShare = {
  /** The shared link, if we found one. */
  url: string | null;
  /** Whatever the user said around it, minus the link itself. */
  note: string;
};

/**
 * Matches an http(s) link. Deliberately does not accept bare hostnames: a
 * share containing the word "instagram.com" in prose is not a link to capture,
 * and guessing wrong sends the extractor after the wrong page.
 */
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/i;

/**
 * Trailing characters that are almost always sentence punctuation rather than
 * part of the link. Closing brackets are handled separately, since they are
 * legitimate in URLs when balanced.
 */
const TRAILING_JUNK = /[.,;:!?]+$/;

function tidy(raw: string): string | null {
  let candidate = raw.trim().replace(TRAILING_JUNK, "");

  // Drop an unbalanced closing paren/bracket, which usually comes from prose
  // like "(see https://example.com/x)" rather than from the URL itself.
  for (const [open, close] of [["(", ")"], ["[", "]"]] as const) {
    while (
      candidate.endsWith(close) &&
      candidate.split(close).length > candidate.split(open).length
    ) {
      candidate = candidate.slice(0, -1);
    }
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Pull the shared link and the user's own words out of a share payload.
 *
 * Field order is deliberate: `url` is the field the spec intends for the link,
 * so it wins when present. `text` is where Android actually puts it. `title`
 * is last — it is normally a headline, and only carries a link when the
 * sharing app has filled in nothing else.
 */
export function parseShare({ title, text, url }: ShareTargetParams): ParsedShare {
  let found: string | null = null;
  let noteSource = "";

  for (const field of [url, text, title]) {
    const value = (field ?? "").trim();
    if (!value) continue;
    const match = value.match(URL_RE);
    const tidied = match ? tidy(match[0]) : null;
    if (tidied) {
      found = tidied;
      // Keep the prose that surrounded the link, not the link itself.
      noteSource = value.replace(match![0], " ");
      break;
    }
  }

  // The note is whatever the user wrote, from the fields that were not the
  // link. Title first: when both are present it is the more descriptive one.
  const parts = [
    (title ?? "").trim(),
    (text ?? "").trim(),
  ];

  const noteParts: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    // Skip the field the link came from — its remainder is handled above.
    if (found && part.includes(found.replace(/\/$/, "").slice(0, 40))) continue;
    noteParts.push(part);
  }
  if (noteSource.trim()) noteParts.unshift(noteSource.trim());

  const note = [...new Set(noteParts.map((p) => p.trim()).filter(Boolean))]
    .join("\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return { url: found, note };
}
