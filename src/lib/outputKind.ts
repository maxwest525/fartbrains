/**
 * What the run should produce.
 *
 * "It depends what we make" is the open question in the product, and it is also
 * the reason pricing is parked — an `agent.md` and a working MVP are not the
 * same cost or the same value. This module makes the question concrete: given
 * what was captured and what the person said they wanted, which artifact is the
 * right one to build.
 *
 * It suggests; it does not decide. The person's own words always win, and the
 * suggestion is always shown with its reason, because a tool that silently
 * picks the wrong artifact wastes the most expensive step in the product.
 */

export type OutputKind =
  /** A written spec. The default: it is useful for everything and cheap. */
  | "spec"
  /** `agent.md` / `AGENTS.md` — instructions for an agent already in a repo. */
  | "agent"
  /** A reusable skill shaped around how this person works. */
  | "skill"
  /** Scaffolded, runnable code. The expensive one. */
  | "mvp"
  /** A repeatable checklist for something to do, not build. */
  | "playbook";

export type OutputSuggestion = {
  kind: OutputKind;
  /** Shown to the person: "you said 'build me', so: an MVP". */
  reason: string;
  /**
   * How sure we are. Below `CONFIRM_BELOW` the UI should ask rather than
   * assume — the compose step is too expensive to spend on a guess.
   */
  confidence: number;
};

export const CONFIRM_BELOW = 0.6;

export const LABELS: Record<OutputKind, string> = {
  spec: "Spec",
  agent: "Agent instructions",
  skill: "Skill",
  mvp: "Working MVP",
  playbook: "Playbook",
};

export const DESCRIPTIONS: Record<OutputKind, string> = {
  spec: "A written brief detailed enough to hand to any agent or developer.",
  agent: "An agent.md your coding agent reads and acts on inside your repo.",
  skill: "A reusable skill, shaped around how you work.",
  mvp: "Scaffolded code you can run.",
  playbook: "A repeatable checklist for doing it, not building it.",
};

/**
 * Phrases in what the person typed. These are strong signals — someone who
 * wrote "build me" has told us what they want and we should not overthink it.
 *
 * Ordered: the first match wins, so the most specific intents come first.
 */
const INTENT: { kind: OutputKind; patterns: RegExp[]; reason: string }[] = [
  {
    kind: "agent",
    patterns: [/\bagents?\.md\b/i, /\bclaude\.md\b/i, /\bagent instructions?\b/i, /\bsystem prompt\b/i],
    reason: "you asked for agent instructions",
  },
  {
    kind: "skill",
    patterns: [/\bskill\b/i, /\bcommand\b/i, /\bshortcut\b/i, /\bautomate this for me\b/i],
    reason: "you asked for a skill",
  },
  {
    kind: "mvp",
    patterns: [
      /\bbuild (me|it|this|a|an)\b/i,
      /\bmake (me|it) (a|an)\b/i,
      /\bmvp\b/i,
      /\bprototype\b/i,
      /\bworking version\b/i,
      /\bship (it|this)\b/i,
    ],
    reason: "you asked for something built",
  },
  {
    kind: "playbook",
    patterns: [/\bplaybook\b/i, /\bchecklist\b/i, /\bstep[- ]by[- ]step\b/i, /\bhow do i (do|run)\b/i, /\bprocess for\b/i],
    reason: "you asked for a process, not a product",
  },
  {
    kind: "spec",
    patterns: [/\bspec\b/i, /\bbrief\b/i, /\bwrite ?up\b/i, /\bplan for\b/i],
    reason: "you asked for a spec",
  },
];

/** Subject matter, used only when the person did not say what they wanted. */
const SUBJECT: { kind: OutputKind; tags: string[]; reason: string }[] = [
  {
    kind: "mvp",
    tags: ["app", "saas", "tool", "product", "landing-page", "website", "extension", "bot"],
    reason: "this is a thing to build",
  },
  {
    kind: "agent",
    tags: ["agent", "agents", "claude", "cursor", "copilot", "llm", "prompt", "prompting", "mcp"],
    reason: "this is about an agent",
  },
  {
    kind: "playbook",
    tags: ["marketing", "seo", "growth", "outreach", "sales", "content", "workflow", "process", "hiring"],
    reason: "this is something to do rather than build",
  },
];

const norm = (s: string) => s.trim().toLowerCase();

export type OutputContext = {
  /** What the person typed — "make this but for instagram too". */
  intent?: string | null;
  /** Tags on the captured item. */
  tags?: string[] | null;
};

/**
 * @returns the artifact to build, why, and how sure. Never null: a spec is
 *   always a defensible answer, so there is nothing to fall through to.
 */
export const suggestOutputKind = (ctx: OutputContext): OutputSuggestion => {
  const intent = (ctx.intent ?? "").trim();

  // What someone explicitly asked for beats anything we infer from the
  // material. This is the whole reason the intent box exists.
  for (const rule of INTENT) {
    if (rule.patterns.some((re) => re.test(intent))) {
      return { kind: rule.kind, reason: rule.reason, confidence: 0.95 };
    }
  }

  const tags = new Set((ctx.tags ?? []).map(norm).filter(Boolean));
  if (tags.size > 0) {
    for (const rule of SUBJECT) {
      const hit = rule.tags.find((t) => tags.has(t));
      if (hit) {
        // Weaker than a stated intent, and deliberately below the confirm
        // threshold in some cases: inferring "build an app" from one tag and
        // then spending the expensive step on it is the bad outcome.
        return { kind: rule.kind, reason: `${rule.reason} ("${hit}")`, confidence: 0.55 };
      }
    }
  }

  return {
    kind: "spec",
    reason: intent ? "nothing more specific to go on" : "no direction given yet",
    confidence: intent ? 0.5 : 0.35,
  };
};

/** Whether the UI should ask before spending the compose step. */
export const shouldConfirm = (s: OutputSuggestion): boolean => s.confidence < CONFIRM_BELOW;
