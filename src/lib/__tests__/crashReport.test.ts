import { describe, it, expect, beforeEach } from "vitest";
import {
  scrubMessage,
  scrubStack,
  scrubComponentStack,
  scrubRoute,
  buildCrashReport,
  recordCrash,
  readCrashes,
  clearCrashes,
  formatCrashes,
  MAX_STORED_CRASHES,
  MAX_MESSAGE_LEN,
} from "../crashReport";

/**
 * Invented content standing in for a note body. The point of every assertion
 * below is that none of it reaches a report.
 */
const NOTE = "Cold email angle: lead with the refund stat, then the calendar link";

beforeEach(() => clearCrashes());

describe("scrubMessage", () => {
  it("removes text React quoted back out of a render", () => {
    const out = scrubMessage(`Objects are not valid as a React child (found: "${NOTE}")`);
    expect(out).not.toContain("refund");
    expect(out).toContain("React child");
  });

  it("removes typographic quotes too, which browsers use in their own messages", () => {
    expect(scrubMessage(`Cannot read “${NOTE}” of undefined`)).not.toContain("refund");
    expect(scrubMessage(`Failed on ‘${NOTE}’`)).not.toContain("refund");
  });

  it("removes URLs, which name the page a capture came from", () => {
    const out = scrubMessage("Failed to fetch https://instagram.com/reel/Cx9zAbC/ for user");
    expect(out).not.toContain("instagram.com");
    expect(out).toContain("<url>");
  });

  it("removes email addresses", () => {
    expect(scrubMessage("no row for someone@example.com")).toBe("no row for <email>");
  });

  it("removes row ids and long tokens", () => {
    expect(scrubMessage("idea 3f1c2b9e-1111-4444-8888-abcdefabcdef missing")).toContain("<uuid>");
    expect(scrubMessage("bad token sk_live_ABCDEFGHIJKLMNOPQRSTUVWX")).toContain("<token>");
  });

  it("removes data URIs, which can inline an entire captured image", () => {
    expect(scrubMessage("bad src data:image/png;base64,iVBORw0KGgoAAAA")).toContain("<data-uri>");
  });

  it("keeps the part of the message that identifies the bug", () => {
    expect(scrubMessage("Cannot read properties of undefined (reading 'map')")).toContain(
      "Cannot read properties of undefined",
    );
  });

  it("survives a thrown non-string without crashing the reporter", () => {
    expect(scrubMessage(undefined)).toBe("");
    expect(scrubMessage(null)).toBe("");
    expect(scrubMessage({ toString: () => "boom" })).toBe("boom");
  });

  it("caps length, so a message that is a whole note body cannot be stored", () => {
    // Short words, so the long-token rule does not collapse it first.
    expect(scrubMessage("wow ".repeat(2000))).toHaveLength(MAX_MESSAGE_LEN);
  });
});

describe("scrubStack", () => {
  it("keeps frames and drops the message line V8 prefixes onto the stack", () => {
    const stack = [
      `Error: rendering ${NOTE}`,
      "    at IdeaCard (https://app.example.com/assets/index-a1b2.js:120:9)",
      "    at renderWithHooks (https://app.example.com/assets/vendor-c3d4.js:8:1)",
    ].join("\n");
    const frames = scrubStack(stack);
    expect(frames.join(" ")).not.toContain("refund");
    expect(frames[0]).toBe("IdeaCard (index-a1b2.js:120:9)");
    expect(frames).toHaveLength(2);
  });

  it("drops the origin, keeping only the bundle filename", () => {
    expect(scrubStack("    at f (https://secret.internal/x/y/app.js:1:2)")[0]).toBe(
      "f (app.js:1:2)",
    );
  });

  it("is empty for a stackless error rather than inventing frames", () => {
    expect(scrubStack(undefined)).toEqual([]);
    expect(scrubStack("")).toEqual([]);
  });
});

describe("scrubComponentStack", () => {
  it("keeps component names, which are source identifiers", () => {
    expect(scrubComponentStack("\n    at IdeaCard\n    at Suspense\n    at App")).toEqual([
      "IdeaCard",
      "Suspense",
      "App",
    ]);
  });

  it("keeps only the identifier when a line carries anything else", () => {
    expect(scrubComponentStack(`    at IdeaCard (${NOTE})`)).toEqual(["IdeaCard"]);
  });
});

describe("scrubRoute", () => {
  it("replaces the row id in an idea route", () => {
    expect(scrubRoute("/idea/3f1c2b9e-1111-4444-8888-abcdefabcdef")).toBe("/idea/:id");
  });

  it("replaces a share token, which is a live credential", () => {
    expect(scrubRoute("/s/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5")).toBe("/s/:token");
  });

  it("keeps static routes readable", () => {
    expect(scrubRoute("/settings/billing")).toBe("/settings/billing");
    expect(scrubRoute("/")).toBe("/");
  });
});

describe("buildCrashReport", () => {
  it("carries no user content from any input", () => {
    const err = new Error(`Failed to render "${NOTE}" from https://example.com/a`);
    err.stack = `Error: ${NOTE}\n    at IdeaCard (https://x/assets/i.js:1:2)`;
    const report = buildCrashReport(err, {
      componentStack: "    at IdeaCard\n    at Vault",
      pathname: "/idea/3f1c2b9e-1111-4444-8888-abcdefabcdef?q=refund",
      now: new Date("2026-01-02T03:04:05.000Z"),
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("refund");
    expect(serialized).not.toContain("example.com");
    expect(report.name).toBe("Error");
    expect(report.at).toBe("2026-01-02T03:04:05.000Z");
    expect(report.components).toEqual(["IdeaCard", "Vault"]);
  });

  it("does not claim a thrown string was an Error", () => {
    expect(buildCrashReport("boom").name).toBe("string");
    expect(buildCrashReport(null).name).toBe("Unknown");
  });
});

describe("the stored log", () => {
  const report = (n: number) => buildCrashReport(new Error(`e${n}`), { pathname: "/" });

  it("is newest first", () => {
    recordCrash(report(1));
    recordCrash(report(2));
    expect(readCrashes().map((r) => r.message)).toEqual(["e2", "e1"]);
  });

  it("never grows without bound", () => {
    for (let i = 0; i < MAX_STORED_CRASHES + 5; i++) recordCrash(report(i));
    expect(readCrashes()).toHaveLength(MAX_STORED_CRASHES);
  });

  it("returns empty rather than throwing on corrupt storage", () => {
    localStorage.setItem("fb.crashes.v1", "{not json");
    expect(readCrashes()).toEqual([]);
    localStorage.setItem("fb.crashes.v1", '{"a":1}');
    expect(readCrashes()).toEqual([]);
  });

  it("clears", () => {
    recordCrash(report(1));
    clearCrashes();
    expect(readCrashes()).toEqual([]);
  });
});

describe("formatCrashes", () => {
  it("says so when there is nothing to report", () => {
    expect(formatCrashes([])).toBe("No errors recorded.");
  });

  it("renders a report a customer can paste into a support message", () => {
    const err = new Error("Cannot read properties of undefined");
    err.stack = "Error: x\n    at IdeaCard (https://x/assets/i.js:1:2)";
    const text = formatCrashes([
      buildCrashReport(err, { pathname: "/idea/1", now: new Date("2026-01-02T03:04:05Z") }),
    ]);
    expect(text).toContain("Error at /idea/:n");
    expect(text).toContain("Cannot read properties of undefined");
    expect(text).toContain("IdeaCard (i.js:1:2)");
  });
});

describe("de-duplication", () => {
  const err = () => {
    const e = new Error("Cannot read properties of undefined");
    e.stack = "Error: x\n    at IdeaCard (https://x/assets/i.js:1:2)";
    return e;
  };
  const at = (iso: string) =>
    buildCrashReport(err(), { pathname: "/idea/1", now: new Date(iso) });

  it("collapses the same failure arriving from boundary and window handler", () => {
    recordCrash(at("2026-01-01T00:00:00.000Z"));
    recordCrash(at("2026-01-01T00:00:00.010Z"));
    expect(readCrashes()).toHaveLength(1);
  });

  it("keeps the same crash when it happens again later", () => {
    recordCrash(at("2026-01-01T00:00:00.000Z"));
    recordCrash(at("2026-01-01T00:01:00.000Z"));
    expect(readCrashes()).toHaveLength(2);
  });

  it("keeps a different crash that lands in the same instant", () => {
    recordCrash(at("2026-01-01T00:00:00.000Z"));
    recordCrash(buildCrashReport(new Error("other"), { now: new Date("2026-01-01T00:00:00.001Z") }));
    expect(readCrashes()).toHaveLength(2);
  });

  it("keeps the same error thrown on a different route", () => {
    recordCrash(at("2026-01-01T00:00:00.000Z"));
    recordCrash(buildCrashReport(err(), { pathname: "/profile", now: new Date("2026-01-01T00:00:00.001Z") }));
    expect(readCrashes()).toHaveLength(2);
  });
});
