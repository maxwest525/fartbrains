/**
 * Escaping for the ILIKE fallback path in search.
 *
 * Two separate hazards, both reachable by typing an ordinary character into
 * the search box:
 *
 *  - PostgREST's `or=(...)` filter is a comma-separated, parenthesised string.
 *    An unquoted value containing a comma or a bracket is parsed as filter
 *    syntax rather than as text, so searching for "a,b" or "foo)" produces a
 *    malformed request instead of results.
 *  - `%` and `_` are ILIKE wildcards. Searching for "50%" currently matches
 *    anything starting "50", which is quietly wrong rather than loudly broken.
 *
 * So the value is wildcard-escaped, then wrapped in PostgREST's double quotes
 * with backslashes and quotes escaped inside.
 */

/** Escape ILIKE wildcards so the term is matched literally. */
export function escapeLike(raw: string): string {
  return raw.replace(/([\\%_])/g, "\\$1");
}

/**
 * A complete, quoted PostgREST filter value for a contains-match on `raw`.
 * Returns null for a blank term, so callers can skip the filter entirely
 * rather than sending `%%` and matching the whole table.
 */
export function likeFilterValue(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const escaped = escapeLike(trimmed).replace(/["\\]/g, (c) => `\\${c}`);
  return `"%${escaped}%"`;
}
