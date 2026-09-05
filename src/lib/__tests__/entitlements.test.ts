import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  can,
  isEntitled,
  statusMessage,
  ALWAYS_AVAILABLE,
  PAID_ONLY,
  STATUS_LABEL,
  type SubscriptionStatus,
} from "../entitlements";

const ALL: SubscriptionStatus[] = [
  "free",
  "trialing",
  "active",
  "past_due",
  "incomplete",
  "unpaid",
  "canceled",
];

describe("isEntitled", () => {
  it("grants access while a card is failing but dunning is still running", () => {
    expect(isEntitled("past_due")).toBe(true);
  });

  it("grants access on trial and while active", () => {
    expect(isEntitled("trialing")).toBe(true);
    expect(isEntitled("active")).toBe(true);
  });

  it("withholds it once dunning is exhausted or the sub is gone", () => {
    expect(isEntitled("unpaid")).toBe(false);
    expect(isEntitled("canceled")).toBe(false);
    expect(isEntitled("incomplete")).toBe(false);
    expect(isEntitled("free")).toBe(false);
  });
});

describe("can", () => {
  it("never takes someone's own data away, whatever their billing state", () => {
    for (const status of ALL) {
      for (const entitlement of ALWAYS_AVAILABLE) {
        expect(can(status, entitlement)).toBe(true);
      }
    }
  });

  it("leaves billing reachable on the states that need fixing", () => {
    expect(can("past_due", "manage_billing")).toBe(true);
    expect(can("canceled", "manage_billing")).toBe(true);
  });

  it("gates every costly action on entitlement", () => {
    for (const entitlement of PAID_ONLY) {
      expect(can("active", entitlement)).toBe(true);
      expect(can("canceled", entitlement)).toBe(false);
      expect(can("free", entitlement)).toBe(false);
    }
  });

  it("keeps the two lists disjoint — an entitlement in both would be ungated", () => {
    const paid = new Set<string>(PAID_ONLY);
    for (const e of ALWAYS_AVAILABLE) expect(paid.has(e)).toBe(false);
  });
});

describe("statusMessage", () => {
  it("tells a cancelled customer their notes are still there", () => {
    const msg = statusMessage("canceled", null, false);
    expect(msg).toMatch(/still here/);
  });

  it("asks for a new card when payment failed", () => {
    expect(statusMessage("past_due", null, false)).toMatch(/Update your card/);
    expect(statusMessage("unpaid", null, false)).toMatch(/Update your card/);
  });

  it("says it cancels, not renews, when cancel_at_period_end is set", () => {
    const end = "2026-04-01T00:00:00.000Z";
    expect(statusMessage("active", end, true)).toMatch(/^Cancels /);
    expect(statusMessage("active", end, false)).toMatch(/^Renews /);
  });

  it("stays quiet for a healthy account with nothing to say", () => {
    expect(statusMessage("active", null, false)).toBeNull();
    expect(statusMessage("free", null, false)).toBeNull();
  });

  it("drops the date rather than printing a broken one", () => {
    expect(statusMessage("trialing", null, false)).toBe("You're on a trial.");
  });

  it("labels every status", () => {
    for (const status of ALL) expect(STATUS_LABEL[status]).toBeTruthy();
  });
});

/**
 * The server copy in `_shared/billing.ts` is what actually enforces access;
 * this one only explains it. If they disagree, the UI either offers a button
 * the server refuses or hides a feature the customer is paying for. Neither is
 * something a type checker can see, because the two files never import from
 * each other — the edge functions run on Deno.
 */
describe("parity with the server", () => {
  const server = readFileSync(
    resolve(__dirname, "../../../supabase/functions/_shared/billing.ts"),
    "utf8",
  );

  const list = (name: string): string[] => {
    const m = server.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\]`));
    if (!m) throw new Error(`${name} not found in billing.ts`);
    return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  };

  it("agrees on which statuses are entitled", () => {
    const m = server.match(/const ENTITLED: SubscriptionStatus\[\] = \[([^\]]*)\]/);
    const serverEntitled = [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    expect(serverEntitled.sort()).toEqual(ALL.filter(isEntitled).sort());
  });

  it("agrees on what survives cancellation", () => {
    expect(list("ALWAYS_AVAILABLE")).toEqual([...ALWAYS_AVAILABLE]);
  });

  it("agrees on what costs money", () => {
    expect(list("PAID_ONLY")).toEqual([...PAID_ONLY]);
  });
});
