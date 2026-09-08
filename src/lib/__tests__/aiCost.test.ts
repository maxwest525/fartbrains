import { describe, it, expect } from "vitest";
import {
  NO_COST,
  costFrom,
  estimate,
  hasPrice,
} from "../../../supabase/functions/_shared/ai-cost";

const response = (usage: unknown, model?: string) => ({
  ...(model ? { model } : {}),
  choices: [{ message: { content: "hi" } }],
  ...(usage === undefined ? {} : { usage }),
});

describe("costFrom", () => {
  it("reads the model and both token counts", () => {
    const c = costFrom(
      response({ prompt_tokens: 1200, completion_tokens: 300 }, "google/gemini-2.5-flash-lite"),
    );
    expect(c.model).toBe("google/gemini-2.5-flash-lite");
    expect(c.inputUnits).toBe(1200);
    expect(c.outputUnits).toBe(300);
    // (1200 * 0.10 + 300 * 0.40) / 1e6
    expect(c.estimatedCost).toBeCloseTo(0.00024, 8);
  });

  it("falls back to the model we asked for when the response omits it", () => {
    const c = costFrom(
      response({ prompt_tokens: 10, completion_tokens: 5 }),
      "google/gemini-2.5-flash",
    );
    expect(c.model).toBe("google/gemini-2.5-flash");
  });

  it("derives the output count from a total when only a total is given", () => {
    const c = costFrom(response({ prompt_tokens: 800, total_tokens: 1000 }, "google/gemini-2.5-flash"));
    expect(c.outputUnits).toBe(200);
  });

  it("does not guess an output count from a total alone", () => {
    const c = costFrom(response({ total_tokens: 1000 }, "google/gemini-2.5-flash"));
    expect(c.inputUnits).toBeNull();
    expect(c.outputUnits).toBeNull();
    expect(c.estimatedCost).toBeNull();
  });

  it("still records the model when usage is missing entirely", () => {
    const c = costFrom(response(undefined, "google/gemini-2.5-flash"));
    expect(c.model).toBe("google/gemini-2.5-flash");
    expect(c.inputUnits).toBeNull();
  });

  it("survives junk", () => {
    expect(costFrom(null)).toEqual(NO_COST);
    expect(costFrom({ usage: "nope" }).inputUnits).toBeNull();
    expect(costFrom({ model: 7, usage: { prompt_tokens: "many" } })).toEqual(NO_COST);
  });

  it("rejects negative and non-finite counts rather than recording them", () => {
    expect(costFrom(response({ prompt_tokens: -5, completion_tokens: 10 })).inputUnits).toBeNull();
    expect(costFrom(response({ prompt_tokens: Infinity, completion_tokens: 10 })).inputUnits).toBeNull();
  });
});

describe("estimate", () => {
  it("returns null for a model we have no price for", () => {
    // Honest null beats a wrong number that poisons every margin calculation
    // built on top of it.
    expect(estimate("google/gemini-3-pro-preview", 1000, 1000)).toBeNull();
    expect(hasPrice("google/gemini-3-pro-preview")).toBe(false);
  });

  it("requires both counts, because input and output are priced differently", () => {
    expect(estimate("google/gemini-2.5-flash", 1000, null)).toBeNull();
    expect(estimate("google/gemini-2.5-flash", null, 1000)).toBeNull();
  });

  it("keeps enough precision that a cheap call is not recorded as zero", () => {
    const usd = estimate("google/gemini-2.5-flash-lite", 100, 20);
    expect(usd).toBeGreaterThan(0);
  });

  it("prices output above input", () => {
    const inHeavy = estimate("google/gemini-2.5-flash", 1000, 0)!;
    const outHeavy = estimate("google/gemini-2.5-flash", 0, 1000)!;
    expect(outHeavy).toBeGreaterThan(inHeavy);
  });

  it("is zero for zero tokens, not null", () => {
    expect(estimate("google/gemini-2.5-flash", 0, 0)).toBe(0);
  });
});
