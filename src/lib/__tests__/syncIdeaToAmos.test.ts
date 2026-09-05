import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * `syncIdeaToAmos` posts note content to a private third-party endpoint.
 * The one thing that must be true of it is that an unconfigured build — which
 * is every build until someone deliberately sets an owner — never makes the
 * request at all, whatever calls it.
 */
const load = async (owner?: string) => {
  vi.resetModules();
  vi.stubEnv("VITE_AMOS_OWNER_EMAIL", owner ?? "");
  return import("../syncIdeaToAmos");
};

const NOTE = { title: "Retainer pitch", raw_note: "open with the churn number" };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("syncIdeaToAmos", () => {
  it("sends nothing when no owner is configured", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { syncIdeaToAmos } = await load();
    syncIdeaToAmos(NOTE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends when an owner is configured", async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchSpy);
    const { syncIdeaToAmos } = await load("owner@example.com");
    syncIdeaToAmos(NOTE);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("never throws, whatever the network does", async () => {
    vi.stubGlobal("fetch", () => {
      throw new Error("offline");
    });
    const { syncIdeaToAmos } = await load("owner@example.com");
    expect(() => syncIdeaToAmos(NOTE)).not.toThrow();
  });
});
