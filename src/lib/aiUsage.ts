/**
 * Client-side mirror of the server's AI quota accounting.
 *
 * The limit is enforced in supabase/functions/_shared/ai-guard.ts. Until now
 * nothing in the app read it, so a free customer discovered their allowance by
 * hitting an error partway through a capture — with no way to see where they
 * stood beforehand.
 *
 * Showing a number means computing it exactly the way the server does, or the
 * display becomes a lie people plan around. Three rules matter:
 *
 *  - The window is the calendar month in UTC, from the 1st.
 *  - Only events with decision 'allowed' count. Refused and refunded calls
 *    do not, which is why a failed transcription does not cost you anything.
 *  - Operations are weighted. A 20-minute transcription is not the same cost
 *    as an auto-tag, so "actions" are not the same as rows.
 *
 * These constants are duplicated from the edge function, which cannot be
 * imported here (Deno, different module graph). The duplication is guarded by
 * a test that parses ai-guard.ts and fails if the two drift apart — a comment
 * saying "change both together" is not a mechanism.
 */

/**
 * Mirrors the guard's plans, past_due included. A customer in dunning keeps
 * the paid allowance, so a meter that showed them the free tier's 50 would be
 * telling them they had run out while the server was still serving them.
 */
export type Plan = "free" | "trialing" | "active" | "past_due";

/** Weighted actions allowed per calendar month, by plan. */
export const MONTHLY_LIMIT: Record<Plan, number> = {
  free: 50,
  trialing: 1_000,
  active: 1_000,
  past_due: 1_000,
};

/** Operations that cost more than one action. Anything absent costs 1. */
export const OPERATION_WEIGHT: Record<string, number> = {
  deep_research: 5,
  transcribe_youtube: 3,
  transcribe_instagram: 3,
  transcribe_deliverables: 3,
  ask: 2,
};

/** Start of the current UTC calendar month — the server's window. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Start of the next UTC month, i.e. when the allowance resets. */
export function monthReset(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Sum event weights the same way the guard does. */
export function weighted(events: Array<{ operation: string }>): number {
  return events.reduce((n, e) => n + (OPERATION_WEIGHT[e.operation] ?? 1), 0);
}

export type UsageSummary = {
  used: number;
  limit: number;
  remaining: number;
  /** 0–1, clamped — a partial refund can briefly exceed the limit. */
  fraction: number;
  resetsAt: Date;
  /** Worth warning about before they hit a wall mid-capture. */
  low: boolean;
  exhausted: boolean;
};

export function summarize(used: number, plan: Plan, now: Date = new Date()): UsageSummary {
  const limit = MONTHLY_LIMIT[plan] ?? MONTHLY_LIMIT.free;
  const remaining = Math.max(0, limit - used);
  return {
    used,
    limit,
    remaining,
    fraction: Math.max(0, Math.min(1, limit > 0 ? used / limit : 0)),
    resetsAt: monthReset(now),
    low: remaining > 0 && remaining <= Math.max(5, Math.round(limit * 0.1)),
    exhausted: remaining === 0,
  };
}
