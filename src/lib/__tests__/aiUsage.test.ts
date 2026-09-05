import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MONTHLY_LIMIT,
  OPERATION_WEIGHT,
  monthReset,
  monthStart,
  summarize,
  weighted,
} from "../aiUsage";

const GUARD = readFileSync(
  resolve(__dirname, "../../../supabase/functions/_shared/ai-guard.ts"),
  "utf8",
);

/**
 * The constants below are duplicated from the edge function, which cannot be
 * imported here. These tests read the real file, so drift fails the build
 * rather than quietly turning the usage meter into a lie.
 */
describe("stays in step with the server's guard", () => {
  it("has the same monthly limit for every plan", () => {
    for (const [plan, limit] of Object.entries(MONTHLY_LIMIT)) {
      const row = new RegExp(`${plan}:\\s*\\{[^}]*perMonth:\\s*([0-9_]+)`).exec(GUARD);
      expect(row, `no perMonth found for plan "${plan}" in ai-guard.ts`).toBeTruthy();
      expect(Number(row![1].replace(/_/g, ""))).toBe(limit);
    }
  });

  it("has the same weight for every weighted operation", () => {
    const block = /OPERATION_WEIGHT[^=]*=\s*\{([^}]*)\}/s.exec(GUARD);
    expect(block, "OPERATION_WEIGHT not found in ai-guard.ts").toBeTruthy();
    const server: Record<string, number> = {};
    for (const m of block![1].matchAll(/(\w+):\s*(\d+)/g)) server[m[1]] = Number(m[2]);
    expect(server).toEqual(OPERATION_WEIGHT);
  });

  it("counts only allowed events, as the guard does", () => {
    expect(GUARD).toContain(`.eq("decision", "allowed")`);
  });
});

describe("weighted", () => {
  it("charges an unlisted operation one action", () => {
    expect(weighted([{ operation: "summarize" }, { operation: "auto_tag" }])).toBe(2);
  });

  it("charges the expensive ones more, so the meter matches the bill", () => {
    expect(weighted([{ operation: "deep_research" }])).toBe(5);
    expect(weighted([{ operation: "transcribe_youtube" }, { operation: "ask" }])).toBe(5);
  });

  it("is zero for no events", () => {
    expect(weighted([])).toBe(0);
  });
});

describe("month window", () => {
  it("starts on the 1st in UTC, not local time", () => {
    // 23:30 on the 31st in UTC-8 is already the 1st in UTC; the server counts
    // in UTC, so the client must not fall back a month here.
    const d = new Date("2026-02-01T07:30:00Z");
    expect(monthStart(d).toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("rolls the reset into the next year in December", () => {
    expect(monthReset(new Date("2026-12-14T00:00:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});

describe("summarize", () => {
  const now = new Date("2026-09-05T00:00:00Z");

  it("reports what is left on the free plan", () => {
    const s = summarize(12, "free", now);
    expect(s).toMatchObject({ used: 12, limit: 50, remaining: 38, exhausted: false, low: false });
  });

  it("warns before the wall rather than at it", () => {
    expect(summarize(45, "free", now).low).toBe(true);
    expect(summarize(950, "active", now).low).toBe(true);
  });

  it("never reports negative remaining, since a refund can overshoot", () => {
    const s = summarize(60, "free", now);
    expect(s.remaining).toBe(0);
    expect(s.fraction).toBe(1);
    expect(s.exhausted).toBe(true);
  });

  it("does not call an exhausted allowance 'low' as well", () => {
    expect(summarize(50, "free", now).low).toBe(false);
  });
});
