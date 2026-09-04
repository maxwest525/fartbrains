// Plan configuration and entitlements — the single source of truth.
//
// Pricing is environment-driven so public prices can be chosen later without
// restructuring anything. Components must never test plan names themselves;
// they ask for an entitlement.

export type SubscriptionStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "incomplete"
  | "unpaid"
  | "canceled";

export type PlanKey = "free" | "pro";

/** Statuses that grant paid entitlements. past_due keeps access during dunning. */
const ENTITLED: SubscriptionStatus[] = ["trialing", "active", "past_due"];

export const isEntitled = (status: SubscriptionStatus): boolean =>
  ENTITLED.includes(status);

/**
 * What an expired or cancelled customer keeps.
 *
 * Losing a subscription must never cost someone their data: reading,
 * searching, exporting and deleting stay available forever. Only new
 * *costly* actions are restricted.
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

/** Price id for a plan, from environment configuration. */
export function priceIdFor(plan: PlanKey): string | null {
  if (plan === "free") return null;
  return Deno.env.get("STRIPE_PRICE_ID_PRO") ?? null;
}

export function planForPrice(priceId: string | null | undefined): PlanKey {
  if (priceId && priceId === Deno.env.get("STRIPE_PRICE_ID_PRO")) return "pro";
  return "free";
}
