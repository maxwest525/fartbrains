import { describe, it, expect } from "vitest";
import {
  ALWAYS_AVAILABLE,
  PAID_ONLY,
  STATUS_LABEL,
  can,
  isEntitled,
  statusMessage,
  type SubscriptionStatus,
} from "@/lib/entitlements";

const ALL: SubscriptionStatus[] = [
  "free", "trialing", "active", "past_due", "incomplete", "unpaid", "canceled",
];

describe("isEntitled", () => {
  it("grants paid features while trialing, active, or in dunning", () => {
    expect(isEntitled("trialing")).toBe(true);
    expect(isEntitled("active")).toBe(true);
    expect(isEntitled("past_due")).toBe(true);
  });

  it("withholds them when free, incomplete, unpaid or canceled", () => {
    expect(isEntitled("free")).toBe(false);
    expect(isEntitled("incomplete")).toBe(false);
    expect(isEntitled("unpaid")).toBe(false);
    expect(isEntitled("canceled")).toBe(false);
  });
});

describe("losing a subscription never costs data access", () => {
  it("keeps reading, searching, exporting and deletion available in every status", () => {
    for (const status of ALL) {
      for (const entitlement of ALWAYS_AVAILABLE) {
        expect(can(status, entitlement)).toBe(true);
      }
    }
  });

  it("restricts only the costly actions", () => {
    for (const entitlement of PAID_ONLY) {
      expect(can("canceled", entitlement)).toBe(false);
      expect(can("active", entitlement)).toBe(true);
    }
  });

  it("a cancelled customer can still manage billing and resubscribe", () => {
    expect(can("canceled", "manage_billing")).toBe(true);
  });
});

describe("statusMessage", () => {
  it("tells a cancelled customer their notes are safe", () => {
    const m = statusMessage("canceled", null, false) ?? "";
    expect(m).toMatch(/still here/i);
    expect(m).toMatch(/export/i);
  });

  it("asks a past_due customer to fix their card", () => {
    expect(statusMessage("past_due", null, false)).toMatch(/update your card/i);
  });

  it("shows the renewal date when active", () => {
    expect(statusMessage("active", "2026-12-01T00:00:00Z", false)).toMatch(/Renews/);
  });

  it("says an active subscription set to cancel keeps access until the date", () => {
    const m = statusMessage("active", "2026-12-01T00:00:00Z", true) ?? "";
    expect(m).toMatch(/Cancels/);
    expect(m).toMatch(/keep access/i);
  });

  it("says nothing for a plain free account", () => {
    expect(statusMessage("free", null, false)).toBeNull();
  });
});

describe("labels", () => {
  it("has a human label for every status", () => {
    for (const s of ALL) expect(STATUS_LABEL[s]).toBeTruthy();
  });
});
