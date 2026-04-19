// Single-user allowlist. Only this email can sign in.
export const ALLOWED_EMAILS = ["admin@trumoveinc.com"];

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}
