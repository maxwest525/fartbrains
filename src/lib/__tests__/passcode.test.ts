import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  clearPasscode,
  hasPasscode,
  isUnlocked,
  lock,
  lockoutRemainingMs,
  setPasscode,
  verifyPasscode,
} from "../passcode";

const V1_HASH = "iv.passcode.hash.v1";
const V2_HASH = "iv.passcode.hash.v2";
const SALT = "iv.passcode.salt.v1";

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** Reproduce the old scheme, to plant a passcode from before the upgrade. */
async function legacyHash(salt: string, code: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + code)));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
});

describe("setting and verifying", () => {
  it("accepts the right code and rejects a wrong one", async () => {
    await setPasscode("1234");
    lock();
    expect(await verifyPasscode("1234")).toBe(true);
    lock();
    expect(await verifyPasscode("9999")).toBe(false);
  });

  it("unlocks the session only on success", async () => {
    await setPasscode("1234");
    lock();
    expect(isUnlocked()).toBe(false);
    await verifyPasscode("0000");
    expect(isUnlocked()).toBe(false);
    await verifyPasscode("1234");
    expect(isUnlocked()).toBe(true);
  });

  it("stores a derived value, never the code itself", async () => {
    await setPasscode("1234");
    const stored = localStorage.getItem(V2_HASH) ?? "";
    expect(stored).not.toContain("1234");
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it("salts, so the same code on two devices does not share a hash", async () => {
    await setPasscode("1234");
    const first = localStorage.getItem(V2_HASH);
    localStorage.clear();
    await setPasscode("1234");
    expect(localStorage.getItem(V2_HASH)).not.toBe(first);
  });

  it("verifies nothing when no passcode is set", async () => {
    expect(hasPasscode()).toBe(false);
    expect(await verifyPasscode("1234")).toBe(false);
  });
});

describe("lockout", () => {
  it("locks out after the attempt limit", async () => {
    await setPasscode("1234");
    lock();
    for (let i = 0; i < MAX_ATTEMPTS; i++) await verifyPasscode("0000");
    expect(lockoutRemainingMs()).toBeGreaterThan(0);
    expect(lockoutRemainingMs()).toBeLessThanOrEqual(LOCKOUT_MS);
  });

  // The bug this replaces: verifyPasscode ignored the lockout entirely, so
  // the only thing enforcing it was the keypad's own React state.
  it("refuses the correct code while locked out", async () => {
    await setPasscode("1234");
    lock();
    for (let i = 0; i < MAX_ATTEMPTS; i++) await verifyPasscode("0000");
    expect(await verifyPasscode("1234")).toBe(false);
    expect(isUnlocked()).toBe(false);
  });

  it("does not let hammering during a lockout extend it", async () => {
    await setPasscode("1234");
    lock();
    for (let i = 0; i < MAX_ATTEMPTS; i++) await verifyPasscode("0000");
    const before = Number(localStorage.getItem("iv.passcode.lockout.v1"));
    for (let i = 0; i < 10; i++) await verifyPasscode("0000");
    expect(Number(localStorage.getItem("iv.passcode.lockout.v1"))).toBe(before);
  });

  it("accepts the code again once the lockout has passed", async () => {
    await setPasscode("1234");
    lock();
    for (let i = 0; i < MAX_ATTEMPTS; i++) await verifyPasscode("0000");
    localStorage.setItem("iv.passcode.lockout.v1", String(Date.now() - 1));
    expect(await verifyPasscode("1234")).toBe(true);
  });

  it("clears the lockout on a successful unlock", async () => {
    await setPasscode("1234");
    lock();
    await verifyPasscode("0000");
    await verifyPasscode("1234");
    expect(localStorage.getItem("iv.passcode.lockout.v1")).toBeNull();
    expect(localStorage.getItem("iv.passcode.fails.v1")).toBe("0");
  });
});

describe("upgrading a passcode set before PBKDF2", () => {
  it("still opens with the legacy hash", async () => {
    localStorage.setItem(SALT, "abc123");
    localStorage.setItem(V1_HASH, await legacyHash("abc123", "1234"));
    expect(hasPasscode()).toBe(true);
    expect(await verifyPasscode("1234")).toBe(true);
  });

  it("re-derives on the slow scheme and drops the legacy hash", async () => {
    localStorage.setItem(SALT, "abc123");
    localStorage.setItem(V1_HASH, await legacyHash("abc123", "1234"));
    await verifyPasscode("1234");
    expect(localStorage.getItem(V2_HASH)).toMatch(/^[0-9a-f]{64}$/);
    // Leaving it would keep the fast, brute-forceable path usable.
    expect(localStorage.getItem(V1_HASH)).toBeNull();
  });

  it("still works on the upgraded hash next time", async () => {
    localStorage.setItem(SALT, "abc123");
    localStorage.setItem(V1_HASH, await legacyHash("abc123", "1234"));
    await verifyPasscode("1234");
    lock();
    expect(await verifyPasscode("1234")).toBe(true);
    lock();
    expect(await verifyPasscode("4321")).toBe(false);
  });

  it("rejects a wrong code against a legacy hash without upgrading", async () => {
    localStorage.setItem(SALT, "abc123");
    localStorage.setItem(V1_HASH, await legacyHash("abc123", "1234"));
    expect(await verifyPasscode("0000")).toBe(false);
    expect(localStorage.getItem(V2_HASH)).toBeNull();
  });
});

describe("clearPasscode", () => {
  it("removes both hashes, the salt and the lock state", async () => {
    await setPasscode("1234");
    localStorage.setItem(V1_HASH, "stale");
    clearPasscode();
    expect(hasPasscode()).toBe(false);
    expect(localStorage.getItem(SALT)).toBeNull();
    expect(isUnlocked()).toBe(false);
  });
});
