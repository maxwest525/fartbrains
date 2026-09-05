/**
 * Where a customer writes to about their data.
 *
 * The legal pages used to render the literal string "[add your support email
 * here]" to anyone who opened them — a note to ourselves, published. A privacy
 * policy whose contact section is a bracket is worse than one that admits the
 * address is not published yet: the first looks like an oversight nobody
 * noticed, the second is a statement.
 *
 * Set VITE_SUPPORT_EMAIL to publish it. Unset, the pages say so plainly.
 */
export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL ?? "").trim();

export const hasSupportEmail = (): boolean =>
  /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(SUPPORT_EMAIL);
