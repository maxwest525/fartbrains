import { describe, it, expect, vi, afterEach } from "vitest";

const load = async (email?: string) => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPPORT_EMAIL", email ?? "");
  return import("../config/supportContact");
};

afterEach(() => vi.unstubAllEnvs());

describe("support contact", () => {
  it("is absent by default rather than a bracketed note to ourselves", async () => {
    const { hasSupportEmail } = await load();
    expect(hasSupportEmail()).toBe(false);
  });

  it("is published once configured", async () => {
    const { hasSupportEmail, SUPPORT_EMAIL } = await load("help@example.com");
    expect(hasSupportEmail()).toBe(true);
    expect(SUPPORT_EMAIL).toBe("help@example.com");
  });

  it("trims whitespace, which a pasted value carries", async () => {
    const { SUPPORT_EMAIL } = await load("  help@example.com  ");
    expect(SUPPORT_EMAIL).toBe("help@example.com");
  });

  it("refuses something that is not an address, rather than publishing it", async () => {
    for (const bad of ["help", "help@", "@example.com", "help at example.com"]) {
      const { hasSupportEmail } = await load(bad);
      expect(hasSupportEmail(), bad).toBe(false);
    }
  });
});
