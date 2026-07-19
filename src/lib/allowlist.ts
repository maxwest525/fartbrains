// Public signup enabled — allow any email.
export const ALLOWED_EMAILS: string[] = [];

export function isEmailAllowed(_email: string | null | undefined): boolean {
  return true;
}
