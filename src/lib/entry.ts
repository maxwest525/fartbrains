// Tracks whether this browser has ever gone past the landing page into the
// vault. The app is PIN-only (Supabase sessions are anonymous and created
// automatically), so "logged in" is not a signal we can route on — a returning
// user is one who has set a passcode, declined to set one, or opened the vault
// at least once on this device.
import { hasOptedOut, hasPasscode } from "@/lib/passcode";

const ENTERED_KEY = "iv.entered.v1";

export function hasEnteredVault(): boolean {
  try {
    return (
      localStorage.getItem(ENTERED_KEY) === "1" || hasPasscode() || hasOptedOut()
    );
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
