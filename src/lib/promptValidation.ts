/**
 * Validation rules for AI-optimized prompts.
 *
 * Two layers:
 *   - Client-side: gate the Save button after the optimizer returns.
 *   - Server-side: same checks run in the optimize-prompt edge function so
 *     bad output never lands in the database even if the client is bypassed.
 *
 * Rules are defined as data so the Settings → Prompt rules screen can render
 * them without duplicating copy.
 */

export type RuleSeverity = "error" | "warning";

export type PromptRule = {
  id: string;
  label: string;
  description: string;
  severity: RuleSeverity;
};

export const MIN_PROMPT_LENGTH = 30;
export const MAX_PROMPT_LENGTH = 12_000;
export const MAX_PROMPT_LINES = 400;

export const PROMPT_RULES: PromptRule[] = [
  {
    id: "non_empty",
    label: "Must not be empty",
    description: "The optimized prompt must contain real content, not just whitespace.",
    severity: "error",
  },
  {
    id: "min_length",
    label: `At least ${MIN_PROMPT_LENGTH} characters`,
    description:
      "Prompts shorter than this almost always indicate an AI failure or truncated response.",
    severity: "error",
  },
  {
    id: "max_length",
    label: `No more than ${MAX_PROMPT_LENGTH.toLocaleString()} characters`,
    description:
      "Hard cap to keep stored ideas reasonable in size and avoid runaway output.",
    severity: "error",
  },
  {
    id: "max_lines",
    label: `No more than ${MAX_PROMPT_LINES} lines`,
    description: "Catches runaway list generation or stuck repetition loops.",
    severity: "error",
  },
  {
    id: "no_code_fences",
    label: "No wrapping ``` code fences",
    description:
      "The optimized prompt should be plain text or markdown, not wrapped in a code block.",
    severity: "error",
  },
  {
    id: "no_meta_preamble",
    label: "No 'Here is the optimized prompt' preamble",
    description:
      "The output should be the prompt itself — no AI meta commentary, headings like 'Optimized prompt:', or sign-offs.",
    severity: "error",
  },
  {
    id: "no_refusal",
    label: "No refusal / disclaimer language",
    description:
      "Phrases like 'As an AI language model' or 'I cannot' indicate the model refused or hedged instead of rewriting.",
    severity: "error",
  },
  {
    id: "no_runaway_repetition",
    label: "No runaway character repetition",
    description:
      "Long runs of the same character (e.g. 50+ in a row) signal a generation loop.",
    severity: "error",
  },
  {
    id: "differs_from_draft",
    label: "Differs from the original draft",
    description:
      "If the optimized prompt is identical to what you pasted in, the optimizer didn't actually do anything.",
    severity: "warning",
  },
  {
    id: "not_too_short_vs_draft",
    label: "Not drastically shorter than the draft",
    description:
      "If the rewrite is less than 25% the length of your draft, the AI likely dropped your intent.",
    severity: "warning",
  },
];

export type ValidationResult = {
  ok: boolean;
  errors: PromptRule[];
  warnings: PromptRule[];
  /** True when only warnings fired — Save can still be allowed via "Save anyway". */
  warningsOnly: boolean;
};

const REFUSAL_PATTERNS = [
  /\bas an ai (language )?model\b/i,
  /\bi (?:cannot|can't|won'?t|am unable to)\b/i,
  /\bi(?:'m| am) sorry,? but\b/i,
  /\bi do not have the ability\b/i,
];

const META_PREAMBLE_PATTERNS = [
  /^\s*(here'?s|here is)\s+(your|the)\s+(optimized|rewritten|improved)/i,
  /^\s*optimized prompt\s*:/i,
  /^\s*rewritten prompt\s*:/i,
  /^\s*sure[,!.]?\s+here/i,
];

const RUNAWAY_REPETITION = /(.)\1{49,}/;

/**
 * Validate an optimizer-generated prompt against PROMPT_RULES.
 * Pass the original draft to enable comparison-based warnings.
 */
export function validateOptimizedPrompt(
  optimized: string,
  draft?: string,
): ValidationResult {
  const errors: PromptRule[] = [];
  const warnings: PromptRule[] = [];
  const ruleById = (id: string) => PROMPT_RULES.find((r) => r.id === id)!;
  const fail = (id: string) => {
    const r = ruleById(id);
    (r.severity === "error" ? errors : warnings).push(r);
  };

  const trimmed = (optimized ?? "").trim();

  if (!trimmed) {
    fail("non_empty");
    return { ok: false, errors, warnings, warningsOnly: false };
  }
  if (trimmed.length < MIN_PROMPT_LENGTH) fail("min_length");
  if (trimmed.length > MAX_PROMPT_LENGTH) fail("max_length");

  const lineCount = trimmed.split("\n").length;
  if (lineCount > MAX_PROMPT_LINES) fail("max_lines");

  if (/^\s*```/.test(trimmed) && /```\s*$/.test(trimmed)) fail("no_code_fences");

  if (META_PREAMBLE_PATTERNS.some((re) => re.test(trimmed))) fail("no_meta_preamble");
  if (REFUSAL_PATTERNS.some((re) => re.test(trimmed))) fail("no_refusal");
  if (RUNAWAY_REPETITION.test(trimmed)) fail("no_runaway_repetition");

  if (draft) {
    const draftTrim = draft.trim();
    if (draftTrim && draftTrim === trimmed) fail("differs_from_draft");
    if (draftTrim && trimmed.length > 0 && trimmed.length < draftTrim.length * 0.25) {
      fail("not_too_short_vs_draft");
    }
  }

  const ok = errors.length === 0;
  return { ok, errors, warnings, warningsOnly: ok && warnings.length > 0 };
}
