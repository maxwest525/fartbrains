import { describe, it, expect } from "vitest";
import { shouldConfirm, suggestOutputKind, LABELS, DESCRIPTIONS } from "../outputKind";

describe("what the person actually said wins", () => {
  it("builds when they say build", () => {
    const s = suggestOutputKind({ intent: "build me this but for instagram too" });
    expect(s.kind).toBe("mvp");
    expect(shouldConfirm(s)).toBe(false);
  });

  it("recognises an agents.md ask", () => {
    expect(suggestOutputKind({ intent: "turn this into an AGENTS.md" }).kind).toBe("agent");
    expect(suggestOutputKind({ intent: "I want a claude.md out of this" }).kind).toBe("agent");
  });

  it("recognises a skill ask", () => {
    expect(suggestOutputKind({ intent: "make this a skill I can reuse" }).kind).toBe("skill");
  });

  it("recognises a process ask", () => {
    expect(suggestOutputKind({ intent: "give me a step-by-step checklist" }).kind).toBe("playbook");
  });

  it("overrides the subject matter", () => {
    // Tags say marketing playbook; the person said build. The person wins.
    const s = suggestOutputKind({ intent: "build me an app for this", tags: ["seo", "marketing"] });
    expect(s.kind).toBe("mvp");
  });

  it("prefers the more specific intent when two could match", () => {
    // "agent instructions" and "spec" both appear; agent is the specific one.
    expect(suggestOutputKind({ intent: "write a spec for the agent instructions" }).kind).toBe("agent");
  });
});

describe("falling back to the subject", () => {
  it("suggests building for a product-shaped capture", () => {
    const s = suggestOutputKind({ tags: ["saas", "pricing"] });
    expect(s.kind).toBe("mvp");
    expect(s.reason).toContain("saas");
  });

  it("suggests a playbook for a marketing capture", () => {
    expect(suggestOutputKind({ tags: ["seo", "backlinks"] }).kind).toBe("playbook");
  });

  it("suggests agent instructions for an agent capture", () => {
    expect(suggestOutputKind({ tags: ["mcp", "tooling"] }).kind).toBe("agent");
  });

  it("asks first, because one tag is not enough to spend the expensive step", () => {
    expect(shouldConfirm(suggestOutputKind({ tags: ["saas"] }))).toBe(true);
  });

  it("is case and whitespace insensitive", () => {
    expect(suggestOutputKind({ tags: ["  SEO  "] }).kind).toBe("playbook");
  });
});

describe("with nothing to go on", () => {
  it("falls back to a spec rather than guessing", () => {
    const s = suggestOutputKind({});
    expect(s.kind).toBe("spec");
    expect(shouldConfirm(s)).toBe(true);
  });

  it("handles nulls", () => {
    expect(suggestOutputKind({ intent: null, tags: null }).kind).toBe("spec");
  });

  it("does not match an intent that only shares a substring", () => {
    // "rebuilding" contains "build" but is not "build me/it/a".
    expect(suggestOutputKind({ intent: "notes on rebuilding trust" }).kind).toBe("spec");
  });
});

describe("presentation", () => {
  it("has a label and a description for every kind", () => {
    for (const kind of ["spec", "agent", "skill", "mvp", "playbook"] as const) {
      expect(LABELS[kind]).toBeTruthy();
      expect(DESCRIPTIONS[kind]).toBeTruthy();
    }
  });

  it("always gives a reason, so the suggestion can be shown with its why", () => {
    expect(suggestOutputKind({}).reason).toBeTruthy();
    expect(suggestOutputKind({ intent: "build me a thing" }).reason).toBeTruthy();
    expect(suggestOutputKind({ tags: ["seo"] }).reason).toBeTruthy();
  });
});
