/**
 * First-run onboarding progress.
 *
 * Stored per account so a returning customer is never shown a step they have
 * already done, and so two accounts on one device do not inherit each other's
 * progress. Deliberately local: onboarding state is not worth a network round
 * trip on first paint, and losing it only costs one skippable screen.
 */

export const ONBOARDING_STEPS = ["capture", "find", "privacy"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingState = {
  completed: OnboardingStep[];
  dismissed: boolean;
};

const EMPTY: OnboardingState = { completed: [], dismissed: false };

const key = (userId: string) => `fb.onboarding.v1.${userId}`;

export function readOnboarding(userId: string | null | undefined): OnboardingState {
  if (!userId) return EMPTY;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    const completed = Array.isArray(parsed.completed)
      ? parsed.completed.filter((s): s is OnboardingStep =>
          (ONBOARDING_STEPS as readonly string[]).includes(s))
      : [];
    return { completed, dismissed: parsed.dismissed === true };
  } catch {
    return EMPTY;
  }
}

export function writeOnboarding(userId: string | null | undefined, state: OnboardingState): void {
  if (!userId) return;
  try {
    localStorage.setItem(key(userId), JSON.stringify(state));
  } catch {
    /* private mode / quota — onboarding is not worth failing over */
  }
}

export function completeStep(
  userId: string | null | undefined,
  step: OnboardingStep,
): OnboardingState {
  const current = readOnboarding(userId);
  if (current.completed.includes(step)) return current;
  const next = { ...current, completed: [...current.completed, step] };
  writeOnboarding(userId, next);
  return next;
}

export function dismissOnboarding(userId: string | null | undefined): OnboardingState {
  const next = { ...readOnboarding(userId), dismissed: true };
  writeOnboarding(userId, next);
  return next;
}

export const isOnboardingComplete = (state: OnboardingState): boolean =>
  state.dismissed || ONBOARDING_STEPS.every((s) => state.completed.includes(s));

/** The next step to show, or null when there is nothing left. */
export function nextStep(state: OnboardingState): OnboardingStep | null {
  if (state.dismissed) return null;
  return ONBOARDING_STEPS.find((s) => !state.completed.includes(s)) ?? null;
}

/**
 * Onboarding is only offered to an account that has not started using the
 * product. Someone with items already — a returning customer, or one who
 * imported first — should never be interrupted by it.
 */
export function shouldShowOnboarding(
  state: OnboardingState,
  itemCount: number,
): boolean {
  if (isOnboardingComplete(state)) return false;
  return itemCount === 0 || state.completed.length > 0;
}
