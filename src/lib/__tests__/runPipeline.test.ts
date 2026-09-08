import { describe, it, expect } from "vitest";
import {
  begin,
  complete,
  createRun,
  currentStage,
  fail,
  isTerminal,
  planFor,
  progress,
  runLabel,
  skip,
  softFailures,
} from "../runPipeline";

describe("planFor", () => {
  it("transcribes a video and not a typed note", () => {
    expect(planFor("video")).toContain("transcribe");
    expect(planFor("text")).not.toContain("transcribe");
  });

  it("reads an image instead of transcribing it", () => {
    expect(planFor("image")).toContain("read");
    expect(planFor("image")).not.toContain("transcribe");
  });

  it("always ends at compose, because that is the only stage that delivers", () => {
    for (const input of ["video", "link", "image", "text"] as const) {
      expect(planFor(input).at(-1)).toBe("compose");
    }
  });
});

describe("a run that goes well", () => {
  it("walks the stages and finishes", () => {
    let run = createRun("video");
    expect(run.status).toBe("idle");
    expect(progress(run)).toBe(0);

    for (const key of planFor("video")) {
      run = begin(run, key);
      expect(run.status).toBe("running");
      expect(currentStage(run)?.key).toBe(key);
      run = complete(run, key, `${key} detail`);
    }

    expect(run.status).toBe("done");
    expect(progress(run)).toBe(1);
    expect(runLabel(run)).toBe("Done");
    expect(isTerminal(run)).toBe(true);
  });

  it("counts an active stage as half done", () => {
    const run = begin(createRun("text"), "detect"); // 3 stages
    expect(progress(run)).toBeCloseTo(0.5 / 3);
  });

  it("keeps the detail it was given", () => {
    const run = complete(begin(createRun("link"), "extract"), "extract", "4 links found");
    expect(run.stages.find((s) => s.key === "extract")?.detail).toBe("4 links found");
  });

  it("points at the next pending stage between stages", () => {
    const run = complete(begin(createRun("text"), "detect"), "detect");
    expect(currentStage(run)?.key).toBe("research");
    expect(runLabel(run)).toBe("Researching around it");
  });
});

describe("skipping", () => {
  it("counts a skipped stage as complete so the bar does not stall", () => {
    let run = createRun("link"); // detect, extract, scrape, research, compose
    run = complete(begin(run, "detect"), "detect");
    run = skip(run, "extract", "no links in the caption");
    expect(progress(run)).toBeCloseTo(2 / 5);
  });

  it("records why, and does not claim the work was done", () => {
    const run = skip(createRun("link"), "scrape", "nothing to open");
    const stage = run.stages.find((s) => s.key === "scrape");
    expect(stage?.status).toBe("skipped");
    expect(stage?.detail).toBe("nothing to open");
  });

  it("finishes a run where everything was skipped except the output", () => {
    let run = createRun("text");
    run = begin(run, "detect");
    run = skip(run, "detect");
    run = skip(run, "research");
    expect(run.status).toBe("running");
    run = complete(begin(run, "compose"), "compose");
    expect(run.status).toBe("done");
  });
});

describe("failing", () => {
  it("does not end the run when an optional stage fails", () => {
    let run = complete(begin(createRun("link"), "detect"), "detect");
    run = fail(run, "scrape", "403 from the page");
    expect(run.status).toBe("running");
    expect(run.error).toBeUndefined();
    expect(softFailures(run).map((s) => s.key)).toEqual(["scrape"]);
  });

  it("still delivers an output after an optional stage failed", () => {
    let run = createRun("link");
    run = complete(begin(run, "detect"), "detect");
    run = fail(run, "extract", "nope");
    run = fail(run, "scrape", "nope");
    run = complete(begin(run, "research"), "research");
    run = complete(begin(run, "compose"), "compose");
    expect(run.status).toBe("done");
    expect(softFailures(run)).toHaveLength(2);
  });

  it("ends the run when compose fails, because there is nothing to hand over", () => {
    let run = createRun("text");
    run = complete(begin(run, "detect"), "detect");
    run = complete(begin(run, "research"), "research");
    run = fail(run, "compose", "model refused");
    expect(run.status).toBe("failed");
    expect(run.error).toBe("model refused");
    expect(runLabel(run)).toBe("model refused");
    expect(softFailures(run)).toHaveLength(0);
    expect(isTerminal(run)).toBe(true);
  });

  it("stays failed once it has failed", () => {
    let run = createRun("text");
    run = fail(run, "compose", "model refused");
    run = complete(begin(run, "detect"), "detect");
    expect(run.status).toBe("failed");
  });
});

describe("late and bogus transitions", () => {
  it("ignores a stage that is not in this run's plan", () => {
    const run = createRun("text");
    expect(begin(run, "transcribe")).toBe(run);
    expect(complete(run, "scrape")).toBe(run);
  });

  it("will not reopen a stage the run has moved past", () => {
    const done = complete(begin(createRun("text"), "detect"), "detect");
    expect(begin(done, "detect")).toBe(done);
  });

  it("will not overwrite a result with a second late callback", () => {
    let run = complete(begin(createRun("text"), "detect"), "detect", "first");
    run = complete(run, "detect", "second");
    expect(run.stages[0].detail).toBe("first");
  });

  it("does not let a late failure undo a completed stage", () => {
    const run = complete(begin(createRun("text"), "detect"), "detect");
    expect(fail(run, "detect", "too late").status).not.toBe("failed");
  });
});

describe("timing", () => {
  it("records when each stage started and ended", () => {
    let run = begin(createRun("text"), "detect", 1000);
    run = complete(run, "detect", undefined, 1400);
    const stage = run.stages[0];
    expect(stage.startedAt).toBe(1000);
    expect(stage.endedAt).toBe(1400);
  });
});
