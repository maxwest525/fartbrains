import { describe, it, expect, vi, afterEach } from "vitest";
import { sanitizeProps, setAnalyticsSink, track } from "@/lib/analytics";

afterEach(() => setAnalyticsSink(null));

describe("analytics never carries private content", () => {
  it("drops any property that is not on the allowlist", () => {
    expect(
      sanitizeProps({
        // These are exactly the things that must never leave the browser.
        note: "my private thought",
        title: "Cold DM framework",
        query: "therapist near me",
        transcript: "…",
        url: "https://example.com/?token=secret",
        email: "someone@example.com",
        tags: "health",
        source_type: "webpage",
      }),
    ).toEqual({ source_type: "webpage" });
  });

  it("keeps only enum-shaped strings, numbers and booleans", () => {
    expect(sanitizeProps({ count: 3, result: "success", plan: "pro" }))
      .toEqual({ count: 3, result: "success", plan: "pro" });
  });

  it("truncates an allowlisted string that is suspiciously long", () => {
    const long = "x".repeat(500);
    const out = sanitizeProps({ result: long });
    expect(String(out.result).length).toBe(32);
  });

  it("drops null and undefined rather than emitting them", () => {
    expect(sanitizeProps({ plan: null, status: undefined, count: 1 })).toEqual({ count: 1 });
  });
});

describe("track", () => {
  it("is a no-op until a sink is installed", () => {
    expect(() => track("search_used")).not.toThrow();
  });

  it("sends the event name and sanitized props to the sink", () => {
    const sink = vi.fn();
    setAnalyticsSink(sink);
    track("capture_completed", { source_type: "manual", note: "leak me" });
    expect(sink).toHaveBeenCalledWith("capture_completed", { source_type: "manual" });
  });

  it("never lets a broken sink break the product", () => {
    setAnalyticsSink(() => { throw new Error("provider down"); });
    expect(() => track("ask_used")).not.toThrow();
  });
});
