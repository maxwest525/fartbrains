// Tracks whether this browser has ever gone past the landing page into the
// vault.
//
// This used to note that "logged in" was not a routable signal, because every
// visitor was auto-signed-in anonymously. That is no longer true: anonymous
// sessions are gone and a session now means a real customer, so being signed in
// is the *best* signal we have — see hasEnteredVault below. The device-local
// markers remain as a fallback for a visitor who has not signed in yet.
import { hasPasscode } from "@/lib/passcode";

const ENTERED_KEY = "iv.entered.v1";

/**
 * Device-local check only. A signed-in customer should also skip the landing
 * page even on a device they have never used, which callers handle by checking
 * the session too — this function cannot, because it is synchronous and runs
 * before auth has resolved.
 */
export function hasEnteredVault(): boolean {
  try {
    return localStorage.getItem(ENTERED_KEY) === "1" || hasPasscode();
  } catch {
    // Storage blocked (private mode, embedded webview) — treat as a returning
    // user so the vault is never unreachable.
    return true;
  }
}

export function markEnteredVault() {
  try {
    localStorage.setItem(ENTERED_KEY, "1");
  } catch { /* ignore — routing just falls back to the landing page */ }
}
