import { describe, it, expect } from "vitest";
import {
  generateShareToken,
  hashShareToken,
  shareStatus,
  shareUrl,
} from "@/lib/share";

describe("share tokens", () => {
  it("produces URL-safe tokens with at least 256 bits of entropy", () => {
    const t = generateShareToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bytes base64url, padding stripped
    expect(t.length).toBe(43);
  });

  it("does not repeat tokens", () => {
    const seen = new Set(Array.from({ length: 500 }, () => generateShareToken()));
    expect(seen.size).toBe(500);
  });

  it("hashes to stable 64-char hex, and different tokens differ", async () => {
    const t = generateShareToken();
    const a = await hashShareToken(t);
    const b = await hashShareToken(t);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashShareToken(generateShareToken())).not.toBe(a);
  });

  it("never embeds the raw token in the stored hash", async () => {
    const t = generateShareToken();
    expect(await hashShareToken(t)).not.toContain(t);
  });

  it("builds a /s/<token> link", () => {
    expect(shareUrl("abc", "https://fartbrain.app")).toBe("https://fartbrain.app/s/abc");
  });
});

describe("shareStatus", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();

  it("is active with no expiry and no revocation", () => {
    expect(shareStatus({ revoked_at: null, expires_at: null })).toBe("active");
  });
  it("is active before expiry", () => {
    expect(shareStatus({ revoked_at: null, expires_at: future })).toBe("active");
  });
  it("is expired after expiry", () => {
    expect(shareStatus({ revoked_at: null, expires_at: past })).toBe("expired");
  });
  it("revocation wins over an unexpired link", () => {
    expect(shareStatus({ revoked_at: past, expires_at: future })).toBe("revoked");
  });
});
