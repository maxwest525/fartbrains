import { describe, it, expect } from "vitest";
import { normalizeOrigin } from "../../../supabase/functions/_shared/cors";

/**
 * Setting ALLOWED_ORIGIN is the one action that stops every edge function
 * answering `Access-Control-Allow-Origin: *`. It is worth making that setting
 * hard to get wrong, because getting it wrong fails silently and totally:
 * every request from the real app is refused and the only clue is a CORS error
 * in a browser console.
 */
describe("normalizeOrigin", () => {
  it("strips the trailing slash an address bar adds", () => {
    // The value a person copies from their browser. An Origin header never has
    // one, so this would have matched nothing at all.
    expect(normalizeOrigin("https://fartbrain.app/")).toBe("https://fartbrain.app");
  });

  it("drops a path, which an Origin header never carries", () => {
    expect(normalizeOrigin("https://fartbrain.app/settings")).toBe("https://fartbrain.app");
  });

  it("lowercases the host", () => {
    expect(normalizeOrigin("HTTPS://Fartbrain.App")).toBe("https://fartbrain.app");
  });

  it("assumes https when the scheme is left off", () => {
    expect(normalizeOrigin("fartbrain.app")).toBe("https://fartbrain.app");
  });

  it("keeps a port, which is part of the origin", () => {
    expect(normalizeOrigin("http://localhost:5173")).toBe("http://localhost:5173");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeOrigin("  https://fartbrain.app  ")).toBe("https://fartbrain.app");
  });

  it("passes through the wildcard, which is a value rather than an origin", () => {
    expect(normalizeOrigin("*")).toBe("*");
  });

  it("returns null for unset or unusable input, so the next source is tried", () => {
    expect(normalizeOrigin(undefined)).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
    expect(normalizeOrigin("   ")).toBeNull();
    expect(normalizeOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeOrigin("file:///etc/passwd")).toBeNull();
  });
});
