/**
 * Decide what a capture is from the text itself.
 *
 * The composer used to open with a nine-way source picker, so every capture
 * began with the customer classifying their own input before they were allowed
 * to type. The app then re-derived most of that answer anyway — `handleExtract`
 * calls `detectUrlPlatform()` and routes on *that*, not on the picked source,
 * and note / list / prompt all persist as `source_type: "manual"`.
 *
 * So the picker asked for work the product then repeated. This runs first
 * instead, and the picker stays as a correction rather than a gate.
 *
 * Deliberately conservative: the cost of a wrong guess is a customer noticing
 * the wrong mode mid-thought, which is worse than not guessing. Anything
 * ambiguous stays a note, which is the mode that loses the least.
 */

export type DetectedKind = "url" | "list" | "transcript" | "note";

/** Below this a paste is just a sentence, not a transcript worth summarizing. */
const TRANSCRIPT_MIN_CHARS = 600;

/** A list needs enough lines to be a list rather than a sentence that wrapped. */
const LIST_MIN_LINES = 3;

/** A line longer than this is prose, whatever it starts with. */
const LIST_MAX_LINE_CHARS = 120;

/** Leading bullet, dash, or "1." / "1)" numbering. */
const BULLET = /^\s*(?:[-*•‣◦]|\d+[.)])\s+/;

/**
 * True when the whole input is one http(s) URL and nothing else.
 *
 * Whole-input only, on purpose: a URL sitting inside a sentence is a note that
 * happens to cite something, and switching modes under someone mid-sentence is
 * exactly the surprise this is meant to avoid.
 */
export const isBareUrl = (raw: string): boolean => {
  const t = raw.trim();
  if (!t || /\s/.test(t)) return false;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export const classifyInput = (raw: string): DetectedKind => {
  const text = raw.trim();
  if (!text) return "note";

  if (isBareUrl(text)) return "url";

  const lines = text.split("\n").map((l) => l.trim());
  const filled = lines.filter(Boolean);

  // A list is short lines, several of them, and at least one of them marked up
  // as an item. Without the bullet test, any pasted paragraph with hard line
  // breaks — song lyrics, an address, a stack trace — becomes a checklist.
  if (
    filled.length >= LIST_MIN_LINES &&
    filled.every((l) => l.length <= LIST_MAX_LINE_CHARS) &&
    filled.some((l) => BULLET.test(l))
  ) {
    return "list";
  }

  if (text.length >= TRANSCRIPT_MIN_CHARS) return "transcript";

  return "note";
};
