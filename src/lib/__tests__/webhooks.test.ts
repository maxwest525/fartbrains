import { describe, it, expect } from "vitest";
import {
  urlProblem,
  urlProblemMessage,
  deliveryStatusLine,
  VERIFY_SNIPPET,
  EXAMPLE_PAYLOAD,
  type FolderWebhook,
} from "../webhooks";

const hook = (over: Partial<FolderWebhook> = {}): FolderWebhook => ({
  folder_id: "f1",
  url: "https://example.com/hook",
  secret: "s",
  enabled: true,
  include_note: true,
  include_summary: true,
  last_status: null,
  last_error: null,
  last_delivered_at: null,
  delivery_count: 0,
  ...over,
});

describe("urlProblem", () => {
  it("accepts an ordinary https endpoint", () => {
    expect(urlProblem("https://hooks.example.com/abc")).toBeNull();
  });

  it("rejects the obvious local addresses before a round trip", () => {
    // This is a courtesy, not the security boundary: the browser cannot
    // resolve DNS, so a public-looking host pointing at a private address gets
    // through here and is caught server-side by assertPublicUrl.
    for (const bad of [
      "http://localhost:3000/hook",
      "http://127.0.0.1/hook",
      "http://10.1.2.3/hook",
      "http://192.168.0.1/hook",
      "http://169.254.169.254/",
      "http://box.local/hook",
    ]) {
      expect(urlProblem(bad), bad).toBe("local");
    }
  });

  it("rejects schemes we would never fetch", () => {
    expect(urlProblem("javascript:alert(1)")).toBe("not_http");
    expect(urlProblem("file:///etc/passwd")).toBe("not_http");
    expect(urlProblem("ftp://example.com")).toBe("not_http");
  });

  it("names the empty and unparseable cases separately", () => {
    expect(urlProblem("")).toBe("empty");
    expect(urlProblem("   ")).toBe("empty");
    expect(urlProblem("not a url")).toBe("unparseable");
  });

  it("caps length at what the column accepts", () => {
    expect(urlProblem("https://x.example/" + "a".repeat(2100))).toBe("too_long");
  });

  it("has a message for every problem it can report", () => {
    for (const p of ["empty", "unparseable", "not_http", "local", "too_long"] as const) {
      expect(urlProblemMessage(p), p).toBeTruthy();
    }
    expect(urlProblemMessage(null)).toBeNull();
  });

  it("says why, not just no", () => {
    // "Invalid URL" tells someone nothing about what to change.
    expect(urlProblemMessage("local")).toMatch(/private network/i);
    expect(urlProblemMessage("not_http")).toMatch(/http/i);
  });
});

describe("deliveryStatusLine", () => {
  it("says nothing has been sent when nothing has", () => {
    expect(deliveryStatusLine(hook())).toBe("Not sent yet.");
  });

  it("leads with the failure when the last attempt failed", () => {
    const line = deliveryStatusLine(
      hook({ last_delivered_at: "2026-09-06T04:00:00Z", last_error: "Endpoint returned 500" }),
    );
    expect(line).toMatch(/failed: Endpoint returned 500/);
  });

  it("counts deliveries, and gets the singular right", () => {
    expect(deliveryStatusLine(hook({ last_delivered_at: "2026-09-06T04:00:00Z", delivery_count: 1 })))
      .toMatch(/1 delivery so far/);
    expect(deliveryStatusLine(hook({ last_delivered_at: "2026-09-06T04:00:00Z", delivery_count: 4 })))
      .toMatch(/4 deliveries so far/);
  });
});

describe("what we tell receivers", () => {
  it("documents the signed string as timestamp, dot, body", () => {
    // The one detail a receiver cannot guess. Getting it wrong means every
    // delivery fails verification and looks like an attack.
    expect(VERIFY_SNIPPET).toContain("${ts}.${body}");
  });

  it("shows a constant-time comparison rather than ===", () => {
    expect(VERIFY_SNIPPET).toContain("timingSafeEqual");
  });

  it("tells them to reject stale deliveries", () => {
    expect(VERIFY_SNIPPET).toMatch(/replayed/);
  });

  it("shows the payload with the fields the function actually sends", () => {
    expect(Object.keys(EXAMPLE_PAYLOAD)).toEqual(["event", "sent_at", "folder_id", "idea"]);
    expect(Object.keys(EXAMPLE_PAYLOAD.idea)).toEqual([
      "id", "title", "note", "summary", "source_url", "tags", "captured_at",
    ]);
  });
});
