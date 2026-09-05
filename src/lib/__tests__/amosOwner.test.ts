import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The gate is read from build configuration at module load, so each case
 * re-imports the module with a different environment.
 */
const load = async (owner?: string) => {
  vi.resetModules();
  vi.stubEnv("VITE_AMOS_OWNER_EMAIL", owner ?? "");
  return import("../amosOwner");
};

afterEach(() => vi.unstubAllEnvs());

describe("with no owner configured — the default, including production", () => {
  it("belongs to nobody", async () => {
    const { isAmosOwner, amosConfigured } = await load();
    expect(amosConfigured()).toBe(false);
    expect(isAmosOwner("anyone@example.com")).toBe(false);
    expect(isAmosOwner(null)).toBe(false);
  });
});

describe("with an owner configured", () => {
  it("matches only that account", async () => {
    const { isAmosOwner } = await load("owner@example.com");
    expect(isAmosOwner("owner@example.com")).toBe(true);
    expect(isAmosOwner("someone.else@example.com")).toBe(false);
  });

  it("ignores case and surrounding space, which providers vary on", async () => {
    const { isAmosOwner } = await load("owner@example.com");
    expect(isAmosOwner("  Owner@Example.COM ")).toBe(true);
  });

  it("does not treat a signed-out or emailless session as the owner", async () => {
    const { isAmosOwner } = await load("owner@example.com");
    expect(isAmosOwner(null)).toBe(false);
    expect(isAmosOwner(undefined)).toBe(false);
    expect(isAmosOwner("")).toBe(false);
  });
});
