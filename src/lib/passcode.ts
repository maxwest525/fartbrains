// Local Apple-style passcode gate. The passcode never leaves this device.
//
// What this is honestly for: stopping someone who picks up your unlocked
// phone or laptop from reading your vault. It is a convenience lock, not
// encryption — the notes themselves are not encrypted with it, and anyone
// who can read this device's storage can attack the stored hash offline.
//
// Two things follow from that, and both are implemented below rather than
// left to callers:
//
//  - The attempt lockout is enforced *here*, not only in the keypad UI. It
//    used to be advisory: verifyPasscode() would happily check a code during
//    a lockout, and only the keypad's own React state stopped it. Any other
//    caller, or a race against the 500ms poll, skipped rate limiting.
//  - Deriving the key is deliberately slow. A 4-digit code is 10,000
//    possibilities; a single SHA-256 checks all of them in well under a
//    second. PBKDF2 at 250k iterations makes each guess cost real time, which
//    turns an instant offline break into a long one. It cannot fix four
//    digits of entropy — nothing here can — but "instant" and "slow" are
//    different enough to be worth the milliseconds on unlock.

const HASH_KEY = "iv.passcode.hash.v1";
const HASH_KEY_V2 = "iv.passcode.hash.v2";
const SALT_KEY = "iv.passcode.salt.v1";
const UNLOCK_KEY = "iv.passcode.unlocked.v1";
const OPTOUT_KEY = "iv.passcode.optout.v1";
const FAIL_COUNT_KEY = "iv.passcode.fails.v1";
const LOCKOUT_UNTIL_KEY = "iv.passcode.lockout.v1";

export const PASSCODE_LENGTH = 4;
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 30_000;

/** Chosen so a guess costs order-100ms on a phone. */
export const PBKDF2_ITERATIONS = 250_000;

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** Legacy v1 derivation. Kept only so existing passcodes still open. */
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

async function derive(salt: string, code: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(code),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return toHex(bits);
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
  return !!(localStorage.getItem(HASH_KEY_V2) || localStorage.getItem(HASH_KEY));
}

export function hasOptedOut(): boolean {
  return localStorage.getItem(OPTOUT_KEY) === "1";
}

export function setOptedOut() {
  localStorage.setItem(OPTOUT_KEY, "1");
}

export function clearOptOut() {
  localStorage.removeItem(OPTOUT_KEY);
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

export function lockoutRemainingMs(): number {
  const until = Number(localStorage.getItem(LOCKOUT_UNTIL_KEY) ?? "0");
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - Date.now());
}

export async function setPasscode(code: string): Promise<void> {
  const salt = getOrCreateSalt();
  localStorage.setItem(HASH_KEY_V2, await derive(salt, code));
  // A stale v1 hash would keep opening the vault on the old, fast scheme.
  localStorage.removeItem(HASH_KEY);
  clearOptOut();
  markUnlocked();
}

function recordFailure(): void {
  const fails = Number(localStorage.getItem(FAIL_COUNT_KEY) ?? "0") + 1;
  if (fails >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKOUT_UNTIL_KEY, String(Date.now() + LOCKOUT_MS));
    localStorage.setItem(FAIL_COUNT_KEY, "0");
  } else {
    localStorage.setItem(FAIL_COUNT_KEY, String(fails));
  }
}

export async function verifyPasscode(code: string): Promise<boolean> {
  // Enforced here rather than trusted to the caller. A locked-out attempt is
  // refused without doing the comparison at all, so hammering during a
  // lockout learns nothing and cannot extend it either.
  if (lockoutRemainingMs() > 0) return false;

  const salt = getOrCreateSalt();
  const storedV2 = localStorage.getItem(HASH_KEY_V2);

  if (storedV2) {
    const ok = (await derive(salt, code)) === storedV2;
    if (ok) markUnlocked();
    else recordFailure();
    return ok;
  }

  // Legacy passcode set before PBKDF2. Verify on the old scheme, and on
  // success silently re-derive so the next unlock uses the slow one. The
  // customer never sees a migration prompt for something they cannot act on.
  const storedV1 = localStorage.getItem(HASH_KEY);
  if (!storedV1) return false;

  const ok = (await sha256(salt + code)) === storedV1;
  if (ok) {
    await setPasscode(code);
  } else {
    recordFailure();
  }
  return ok;
}

export function clearPasscode() {
  localStorage.removeItem(HASH_KEY);
  localStorage.removeItem(HASH_KEY_V2);
  localStorage.removeItem(SALT_KEY);
  localStorage.removeItem(FAIL_COUNT_KEY);
  localStorage.removeItem(LOCKOUT_UNTIL_KEY);
  localStorage.removeItem(OPTOUT_KEY);
  sessionStorage.removeItem(UNLOCK_KEY);
}
