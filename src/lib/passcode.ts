// Local Apple-style passcode gate. The passcode never leaves this device.
// We store a salted SHA-256 hash in localStorage; on unlock we re-hash the
// entered digits and compare. Cloud auth (auto sign-in as the owner account)
// only runs AFTER the local gate is unlocked.

const HASH_KEY = "iv.passcode.hash.v1";
const SALT_KEY = "iv.passcode.salt.v1";
const UNLOCK_KEY = "iv.passcode.unlocked.v1";
const FAIL_COUNT_KEY = "iv.passcode.fails.v1";
const LOCKOUT_UNTIL_KEY = "iv.passcode.lockout.v1";

export const PASSCODE_LENGTH = 4;
export const MAX_ATTEMPTS = Number.POSITIVE_INFINITY;
export const LOCKOUT_MS = 0;
export const DEFAULT_PASSCODE = "5259";

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

function getOrCreateSalt(): string {
  let s = localStorage.getItem(SALT_KEY);
  if (!s) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    s = toHex(bytes.buffer);
    localStorage.setItem(SALT_KEY, s);
  }
  return s;
}

export function hasPasscode(): boolean {
  return !!localStorage.getItem(HASH_KEY);
}

export function isUnlocked(): boolean {
  return sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function markUnlocked() {
  sessionStorage.setItem(UNLOCK_KEY, "1");
  localStorage.setItem(FAIL_COUNT_KEY, "0");
  localStorage.removeItem(LOCKOUT_UNTIL_KEY);
}

export function lock() {
  sessionStorage.removeItem(UNLOCK_KEY);
}

export async function setPasscode(code: string): Promise<void> {
  const salt = getOrCreateSalt();
  const hash = await sha256(salt + code);
  localStorage.setItem(HASH_KEY, hash);
  markUnlocked();
}

export async function verifyPasscode(code: string): Promise<boolean> {
  const stored = localStorage.getItem(HASH_KEY);
  if (!stored) return false;
  const salt = getOrCreateSalt();
  const hash = await sha256(salt + code);
  const ok = hash === stored;
  if (ok) {
    markUnlocked();
  } else {
    const fails = (Number(localStorage.getItem(FAIL_COUNT_KEY)) || 0) + 1;
    localStorage.setItem(FAIL_COUNT_KEY, String(fails));
    if (fails >= MAX_ATTEMPTS) {
      localStorage.setItem(LOCKOUT_UNTIL_KEY, String(Date.now() + LOCKOUT_MS));
    }
  }
  return ok;
}

export function lockoutRemainingMs(): number {
  const until = Number(localStorage.getItem(LOCKOUT_UNTIL_KEY)) || 0;
  return Math.max(0, until - Date.now());
}

export function clearPasscode() {
  localStorage.removeItem(HASH_KEY);
  localStorage.removeItem(SALT_KEY);
  localStorage.removeItem(FAIL_COUNT_KEY);
  localStorage.removeItem(LOCKOUT_UNTIL_KEY);
  sessionStorage.removeItem(UNLOCK_KEY);
}
