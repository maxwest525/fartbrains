/**
 * The state of one run.
 *
 * A run is the loop: you hand in a reel, and somewhere down the line an output
 * comes back. Today that whole stretch is a spinner labelled "Generating
 * summary", which is wrong in two ways — it is not one step, and most of the
 * time it is not summarizing. The interesting part of this product is watching
 * it work, and you cannot watch a boolean.
 *
 * This module is the state, and nothing else. No network, no React, no timers.
 * The stages are data so the pipeline can differ by input — a pasted note has
 * nothing to transcribe and no links to follow — and so the UI can render a run
 * it did not start, which is what makes a run resumable and shareable later.
 */

export type StageKey =
  | "detect"
  | "transcribe"
  | "read"
  | "extract"
  | "scrape"
  | "research"
  | "compose";

export type StageStatus = "pending" | "active" | "done" | "skipped" | "failed";

export type Stage = {
  key: StageKey;
  /** Shown while the stage is running: "Transcribing the reel". */
  running: string;
  /** Shown once it is done: "Transcribed". Past tense, because it is. */
  done: string;
  status: StageStatus;
  /**
   * What actually happened — "4 links found", "2,310 words". This is the part
   * worth watching; the stage name alone is just a progress bar with words.
   */
  detail?: string;
  /**
   * A required stage failing ends the run. Scraping a page that 403s should
   * not throw away a good transcript, so most stages are not required.
   */
  required: boolean;
  startedAt?: number;
  endedAt?: number;
};

export type RunStatus = "idle" | "running" | "done" | "failed";

export type Run = {
  stages: Stage[];
  status: RunStatus;
  /** Set only when a required stage failed. */
  error?: string;
};

type StageSpec = {
  key: StageKey;
  running: string;
  done: string;
  required?: boolean;
};

/**
 * Every stage the product can run, in the order they happen. A given run uses
 * a subset — see `planFor`.
 *
 * `compose` is required because it is the only stage whose absence means the
 * person got nothing. Everything upstream of it is material: nice to have,
 * survivable to lose.
 */
const CATALOG: Record<StageKey, StageSpec> = {
  detect: { key: "detect", running: "Working out what this is", done: "Identified" },
  transcribe: { key: "transcribe", running: "Transcribing", done: "Transcribed" },
  read: { key: "read", running: "Reading the image", done: "Read" },
  extract: { key: "extract", running: "Pulling out links and references", done: "Links extracted" },
  scrape: { key: "scrape", running: "Opening the pages it points at", done: "Pages read" },
  research: { key: "research", running: "Researching around it", done: "Researched" },
  compose: { key: "compose", running: "Building your output", done: "Built", required: true },
};

/** What kind of thing was handed in. Decides which stages are even possible. */
export type RunInput = "video" | "link" | "image" | "text";

const PLANS: Record<RunInput, StageKey[]> = {
  // The one path: an Instagram reel.
  video: ["detect", "transcribe", "extract", "scrape", "research", "compose"],
  link: ["detect", "extract", "scrape", "research", "compose"],
  image: ["detect", "read", "extract", "research", "compose"],
  // A typed idea has nothing to fetch, so going straight to research is not a
  // shortcut — there is genuinely nothing in between.
  text: ["detect", "research", "compose"],
};

export const planFor = (input: RunInput): StageKey[] => PLANS[input];

export const createRun = (input: RunInput): Run => ({
  status: "idle",
  stages: planFor(input).map((key) => ({
    ...CATALOG[key],
    required: CATALOG[key].required ?? false,
    status: "pending" as StageStatus,
  })),
});

const terminal = (s: StageStatus) => s === "done" || s === "skipped" || s === "failed";

const patch = (run: Run, key: StageKey, next: Partial<Stage>): Run => ({
  ...run,
  stages: run.stages.map((s) => (s.key === key ? { ...s, ...next } : s)),
});

/**
 * Mark a stage as running. Ignored if the stage is not in this run or has
 * already finished — a late callback from a retried request must not reopen a
 * stage the run has moved past.
 */
export const begin = (run: Run, key: StageKey, at = Date.now()): Run => {
  const stage = run.stages.find((s) => s.key === key);
  if (!stage || terminal(stage.status)) return run;
  return {
    ...patch(run, key, { status: "active", startedAt: at }),
    status: run.status === "idle" ? "running" : run.status,
  };
};

export const complete = (run: Run, key: StageKey, detail?: string, at = Date.now()): Run => {
  const stage = run.stages.find((s) => s.key === key);
  if (!stage || terminal(stage.status)) return run;
  const next = patch(run, key, { status: "done", detail, endedAt: at });
  return { ...next, status: settle(next) };
};

/**
 * A stage that had nothing to do. Distinct from done, because "Pages read" on a
 * reel with no links in the caption is a small lie, and distinct from failed,
 * because nothing went wrong.
 */
export const skip = (run: Run, key: StageKey, reason?: string, at = Date.now()): Run => {
  const stage = run.stages.find((s) => s.key === key);
  if (!stage || terminal(stage.status)) return run;
  const next = patch(run, key, { status: "skipped", detail: reason, endedAt: at });
  return { ...next, status: settle(next) };
};

export const fail = (run: Run, key: StageKey, error: string, at = Date.now()): Run => {
  const stage = run.stages.find((s) => s.key === key);
  if (!stage || terminal(stage.status)) return run;
  const next = patch(run, key, { status: "failed", detail: error, endedAt: at });
  // Only a required stage ends the run. Anything else is a gap in the material.
  if (!stage.required) return { ...next, status: settle(next) };
  return { ...next, status: "failed", error };
};

/** Whether everything in the run has reached a terminal state. */
const settle = (run: Run): RunStatus => {
  if (run.status === "failed") return "failed";
  return run.stages.every((s) => terminal(s.status)) ? "done" : "running";
};

/** The stage to point at right now: the active one, else the next pending one. */
export const currentStage = (run: Run): Stage | null =>
  run.stages.find((s) => s.status === "active") ??
  run.stages.find((s) => s.status === "pending") ??
  null;

/**
 * 0 to 1, counting an active stage as half done.
 *
 * Skipped counts as complete. A bar that stalls because a stage had nothing to
 * do reads as a hang, and "it looks stuck" is indistinguishable from stuck.
 */
export const progress = (run: Run): number => {
  if (run.stages.length === 0) return 0;
  const earned = run.stages.reduce((sum, s) => {
    if (s.status === "active") return sum + 0.5;
    return terminal(s.status) ? sum + 1 : sum;
  }, 0);
  return Math.min(1, earned / run.stages.length);
};

/** One line for a collapsed view or a screen reader. */
export const runLabel = (run: Run): string => {
  if (run.status === "failed") return run.error ?? "Run failed";
  if (run.status === "done") return "Done";
  const stage = currentStage(run);
  return stage ? stage.running : "Starting";
};

/** Stages that failed without ending the run — worth telling someone about. */
export const softFailures = (run: Run): Stage[] =>
  run.stages.filter((s) => s.status === "failed" && !s.required);

export const isTerminal = (run: Run): boolean =>
  run.status === "done" || run.status === "failed";
