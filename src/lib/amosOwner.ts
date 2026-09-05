/**
 * Gate for the AMOS mirror.
 *
 * `syncIdeaToAmos` POSTs an idea's title and body to a private Cloud Run
 * endpoint that belongs to one person's own marketing system. That is a
 * useful workflow for its owner and completely wrong for anybody else: it
 * sends note content to a third party the customer never agreed to, and the
 * "Send to Mark" button names a project that means nothing to them.
 *
 * So the integration is owner-scoped. `VITE_AMOS_OWNER_EMAIL` names the one
 * account it runs for; with it unset — which is the default, including in
 * production until someone sets it — no request is ever made and the button
 * is not rendered.
 *
 * The email lives in build configuration rather than in this repository. It
 * is compared locally against the signed-in session and is never sent
 * anywhere.
 */

const OWNER_EMAIL = (import.meta.env.VITE_AMOS_OWNER_EMAIL ?? "").trim().toLowerCase();

/** True only for the single account the integration belongs to. */
export function isAmosOwner(email: string | null | undefined): boolean {
  if (!OWNER_EMAIL) return false;
  return (email ?? "").trim().toLowerCase() === OWNER_EMAIL;
}

/** Whether the build has an owner configured at all. */
export const amosConfigured = (): boolean => OWNER_EMAIL.length > 0;
