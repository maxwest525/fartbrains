/**
 * Share-link tokens.
 *
 * The raw token exists only in the link the owner copies. We store its SHA-256
 * hex in `idea_shares.token_hash`, so a database dump yields no working links
 * and the idea's UUID is never used as authorization.
 */

const TOKEN_BYTES = 32; // 256 bits — not enumerable

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** Cryptographically secure, URL-safe share token. */
export function generateShareToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** SHA-256 hex of a token — the only form that reaches the server. */
export async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const shareUrl = (token: string, origin = window.location.origin): string =>
  `${origin}/s/${token}`;

export type ShareStatus = "active" | "revoked" | "expired";

export function shareStatus(share: {
  revoked_at: string | null;
  expires_at: string | null;
}): ShareStatus {
  if (share.revoked_at) return "revoked";
  if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}
