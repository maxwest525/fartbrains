/**
 * Plan entitlements — the single client-side source of truth.
 *
 * Components ask "can this account do X", never "is this account on plan Y".
 * This mirrors `supabase/functions/_shared/billing.ts`; the server copy is
 * authoritative and is what actually enforces anything. This one exists only so
 * the UI can explain and pre-empt, never to grant access.
 */

export type SubscriptionStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "incomplete"
  | "unpaid"
  | "canceled";

/** Statuses that grant paid entitlements. past_due keeps access during dunning. */
const ENTITLED: SubscriptionStatus[] = ["trialing", "active", "past_due"];

export const isEntitled = (status: SubscriptionStatus): boolean =>
  ENTITLED.includes(status);

/**
 * Losing a subscription must never cost someone their data. Reading,
 * searching, exporting and account deletion stay available forever; only new
 * costly actions are restricted.
 */
export const ALWAYS_AVAILABLE = [
  "read",
  "search",
  "export",
  "delete_account",
  "manage_billing",
] as const;

export const PAID_ONLY = [
  "ai_summarize",
  "ai_ask",
  "ai_research",
  "transcription",
] as const;

export type Entitlement =
  | (typeof ALWAYS_AVAILABLE)[number]
  | (typeof PAID_ONLY)[number];

export function can(status: SubscriptionStatus, entitlement: Entitlement): boolean {
  if ((ALWAYS_AVAILABLE as readonly string[]).includes(entitlement)) return true;
  return isEntitled(status);
}

export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  free: "Free",
  trialing: "Trial",
  active: "Active",
  past_due: "Payment failed",
  incomplete: "Payment incomplete",
  unpaid: "Unpaid",
  canceled: "Canceled",
};

/** What to tell the customer about their current state, if anything. */
export function statusMessage(
  status: SubscriptionStatus,
  periodEnd: string | null,
  cancelAtPeriodEnd: boolean,
): string | null {
  const when = periodEnd ? new Date(periodEnd).toLocaleDateString() : null;
  switch (status) {
    case "past_due":
    case "unpaid":
      return "We couldn't take your last payment. Update your card to keep AI features.";
    case "incomplete":
      return "Your payment didn't finish. Try checking out again.";
    case "canceled":
      return "Your subscription ended. Your notes are all still here — you can read, search and export them any time.";
    case "trialing":
      return when ? `Trial ends ${when}.` : "You're on a trial.";
    case "active":
      if (cancelAtPeriodEnd) {
        return when ? `Cancels ${when}. You keep access until then.` : "Cancels at the end of this period.";
      }
      return when ? `Renews ${when}.` : null;
    default:
      return null;
  }
}
