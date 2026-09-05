import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_PROMPT_LENGTH,
  MAX_PROMPT_LINES,
  MIN_PROMPT_LENGTH,
  PROMPT_RULES,
  validateOptimizedPrompt,
} from "../promptValidation";

const SERVER = readFileSync(
  resolve(__dirname, "../../../supabase/functions/optimize-prompt/index.ts"),
  "utf8",
);

const good = "Act as a senior growth engineer and draft a plan for onboarding.";

describe("gate", () => {
  it("passes a normal optimized prompt", () => {
    const r = validateOptimizedPrompt(good);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects empty, and stops there rather than piling on rules", () => {
    const r = validateOptimizedPrompt("   ");
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.id)).toEqual(["non_empty"]);
  });

  it("measures length after trimming, as the server does", () => {
    const body = "x".repeat(MIN_PROMPT_LENGTH - 1);
    expect(validateOptimizedPrompt(`   ${body}   `).errors.map((e) => e.id)).toContain(
      "min_length",
    );
  });

  it("rejects over-long and over-tall output", () => {
    expect(
      validateOptimizedPrompt("x".repeat(MAX_PROMPT_LENGTH + 1)).errors.map((e) => e.id),
    ).toContain("max_length");
    expect(
      validateOptimizedPrompt(`${good}\n`.repeat(MAX_PROMPT_LINES + 1)).errors.map((e) => e.id),
    ).toContain("max_lines");
  });
});

describe("the shapes a model returns instead of a prompt", () => {
  it("catches a fenced block", () => {
    expect(
      validateOptimizedPrompt("```\n" + good + "\n```").errors.map((e) => e.id),
    ).toContain("no_code_fences");
  });

  it("catches a meta preamble", () => {
    for (const s of [
      `Here's your optimized prompt: ${good}`,
      `Optimized prompt: ${good}`,
      `Sure, here you go. ${good}`,
    ]) {
      expect(validateOptimizedPrompt(s).errors.map((e) => e.id)).toContain("no_meta_preamble");
    }
  });

  it("catches a refusal dressed up as output", () => {
    for (const s of [
      `As an AI language model, ${good}`,
      `I cannot help with that. ${good}`,
      `I'm sorry, but ${good}`,
    ]) {
      expect(validateOptimizedPrompt(s).errors.map((e) => e.id)).toContain("no_refusal");
    }
  });

  it("catches runaway repetition", () => {
    expect(
      validateOptimizedPrompt(good + "a".repeat(60)).errors.map((e) => e.id),
    ).toContain("no_runaway_repetition");
  });

  it("does not mistake ordinary prose for a refusal", () => {
    const s = "Explain why the migration cannot be reversed once applied, and what to do instead.";
    expect(validateOptimizedPrompt(s).ok).toBe(true);
  });
});

describe("comparison against the draft", () => {
  it("warns when the optimizer handed back the draft unchanged", () => {
    const r = validateOptimizedPrompt(good, good);
    expect(r.warnings.map((w) => w.id)).toContain("differs_from_draft");
  });

  it("warns when the result collapsed to a fraction of the draft", () => {
    const draft = "y".repeat(600);
    const r = validateOptimizedPrompt(good, draft);
    expect(r.warnings.map((w) => w.id)).toContain("not_too_short_vs_draft");
  });

  it("reports warnings-only so Save can still be offered", () => {
    const r = validateOptimizedPrompt(good, good);
    expect(r.ok).toBe(true);
    expect(r.warningsOnly).toBe(true);
  });

  it("does not compare when no draft is supplied", () => {
    expect(validateOptimizedPrompt(good).warnings).toEqual([]);
  });
});

/**
 * The optimize-prompt edge function re-runs these checks server-side so bad
 * output cannot land in the database when the client is bypassed. It declares
 * its own copies of the limits and patterns — Deno, different module graph —
 * so nothing but this test stops the two from drifting apart.
 */
describe("stays in step with the optimize-prompt edge function", () => {
  it("uses the same limits", () => {
    const num = (name: string) => {
      const m = new RegExp(`${name}\\s*=\\s*([0-9_]+)`).exec(SERVER);
      expect(m, `${name} not found in optimize-prompt`).toBeTruthy();
      return Number(m![1].replace(/_/g, ""));
    };
    expect(num("MIN_LEN")).toBe(MIN_PROMPT_LENGTH);
    expect(num("MAX_LEN")).toBe(MAX_PROMPT_LENGTH);
    expect(num("MAX_LINES")).toBe(MAX_PROMPT_LINES);
  });

  it("carries the same refusal and preamble patterns", () => {
    // Compared as source text: a pattern that exists on one side only would
    // mean output rejected in the browser but accepted by the server.
    for (const re of [
      String.raw`\bas an ai (language )?model\b`,
      String.raw`\bi (?:cannot|can't|won'?t|am unable to)\b`,
      String.raw`^\s*optimized prompt\s*:`,
      String.raw`^\s*sure[,!.]?\s+here`,
    ]) {
      expect(SERVER, `missing from optimize-prompt: ${re}`).toContain(re);
    }
  });

  it("trims before measuring, or the two disagree at the boundary", () => {
    expect(SERVER).toMatch(/content\?\.trim\(\)/);
  });

  it("enforces every error-severity rule, not just the warnings", () => {
    // Warning-only rules are client-side judgement calls; error rules are the
    // ones that must hold server-side too.
    const serverEnforced = new Set([
      "non_empty", "min_length", "max_length", "max_lines",
      "no_code_fences", "no_meta_preamble", "no_refusal", "no_runaway_repetition",
    ]);
    const errorRules = PROMPT_RULES.filter((r) => r.severity === "error").map((r) => r.id);
    expect(errorRules.filter((id) => !serverEnforced.has(id))).toEqual([]);
  });
});
