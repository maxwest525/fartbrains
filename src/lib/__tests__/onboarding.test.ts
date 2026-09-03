import { describe, it, expect, beforeEach } from "vitest";
import {
  ONBOARDING_STEPS,
  completeStep,
  dismissOnboarding,
  isOnboardingComplete,
  nextStep,
  readOnboarding,
  shouldShowOnboarding,
  writeOnboarding,
} from "@/lib/onboarding";

const USER = "user-a";
const OTHER = "user-b";

beforeEach(() => localStorage.clear());

describe("progress persistence", () => {
  it("starts empty", () => {
    expect(readOnboarding(USER)).toEqual({ completed: [], dismissed: false });
  });

  it("remembers completed steps so a returning user never repeats them", () => {
    completeStep(USER, "capture");
    expect(readOnboarding(USER).completed).toEqual(["capture"]);
    expect(nextStep(readOnboarding(USER))).toBe("find");
  });

  it("does not double-record a step", () => {
    completeStep(USER, "capture");
    completeStep(USER, "capture");
    expect(readOnboarding(USER).completed).toEqual(["capture"]);
  });

  it("keeps two accounts on one device separate", () => {
    completeStep(USER, "capture");
    expect(readOnboarding(OTHER).completed).toEqual([]);
  });

  it("is a no-op without a signed-in user", () => {
    expect(() => writeOnboarding(null, { completed: ["capture"], dismissed: false })).not.toThrow();
    expect(readOnboarding(null).completed).toEqual([]);
  });

  it("survives corrupted storage", () => {
    localStorage.setItem(`fb.onboarding.v1.${USER}`, "{not json");
    expect(readOnboarding(USER)).toEqual({ completed: [], dismissed: false });
  });

  it("ignores unknown step names from an older version", () => {
    localStorage.setItem(
      `fb.onboarding.v1.${USER}`,
      JSON.stringify({ completed: ["capture", "retired-step"], dismissed: false }),
    );
    expect(readOnboarding(USER).completed).toEqual(["capture"]);
  });
});

describe("completion", () => {
  it("is complete once every step is done", () => {
    for (const s of ONBOARDING_STEPS) completeStep(USER, s);
    expect(isOnboardingComplete(readOnboarding(USER))).toBe(true);
    expect(nextStep(readOnboarding(USER))).toBeNull();
  });

  it("skipping ends it immediately", () => {
    dismissOnboarding(USER);
    expect(isOnboardingComplete(readOnboarding(USER))).toBe(true);
    expect(nextStep(readOnboarding(USER))).toBeNull();
  });
});

describe("when to show it", () => {
  it("shows to a brand-new empty account", () => {
    expect(shouldShowOnboarding(readOnboarding(USER), 0)).toBe(true);
  });

  it("does not interrupt an account that already has items", () => {
    expect(shouldShowOnboarding(readOnboarding(USER), 42)).toBe(false);
  });

  it("keeps going once started, even though the first capture created an item", () => {
    const state = completeStep(USER, "capture");
    expect(shouldShowOnboarding(state, 1)).toBe(true);
  });

  it("never shows again after it is finished", () => {
    for (const s of ONBOARDING_STEPS) completeStep(USER, s);
    expect(shouldShowOnboarding(readOnboarding(USER), 0)).toBe(false);
  });

  it("never shows again after it is skipped", () => {
    dismissOnboarding(USER);
    expect(shouldShowOnboarding(readOnboarding(USER), 0)).toBe(false);
  });
});
