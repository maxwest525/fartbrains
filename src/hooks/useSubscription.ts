import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SubscriptionStatus } from "@/lib/entitlements";
import { track } from "@/lib/analytics";

export type Subscription = {
  status: SubscriptionStatus;
  plan_key: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
};

const FREE: Subscription = {
  status: "free",
  plan_key: "free",
  current_period_end: null,
  cancel_at_period_end: false,
  trial_end: null,
};

/**
 * The customer's own subscription row. Read-only by row level security: only
 * verified Stripe webhooks may write billing state, so this can never be the
 * thing that grants access — the server decides that.
 */
export function useSubscription() {
  return useQuery({
    queryKey: ["subscription"],
    queryFn: async (): Promise<Subscription> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("status, plan_key, current_period_end, cancel_at_period_end, trial_end")
        .maybeSingle();
      // No row, or the table not deployed yet, both mean "free".
      if (error || !data) return FREE;
      return data as Subscription;
    },
    staleTime: 60_000,
  });
}

const redirectTo = async (fn: "create-checkout-session" | "create-portal-session", body?: unknown) => {
  const { data, error } = await supabase.functions.invoke(fn, { body: body ?? {} });
  if (error) throw new Error("Billing isn't available right now. Try again shortly.");
  const url = (data as { url?: string; error?: string } | null)?.url;
  if (!url) throw new Error((data as { error?: string } | null)?.error ?? "Couldn't open billing.");
  window.location.href = url;
};

export function useStartCheckout() {
  return useMutation({
    mutationFn: (plan: string = "pro") => {
      track("checkout_started", { plan });
      return redirectTo("create-checkout-session", { plan });
    },
  });
}

export function useOpenBillingPortal() {
  return useMutation({ mutationFn: () => redirectTo("create-portal-session") });
}
