import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { monthStart, summarize, weighted, type Plan, type UsageSummary } from "@/lib/aiUsage";

/**
 * This month's AI allowance, counted the way the server counts it.
 *
 * Read directly from ai_usage_events under row level security, so a customer
 * sees their own usage and nobody else's. Only the operation column is
 * selected: the meter needs weights, not what anyone captured.
 */
export function useAiUsage() {
  const { data: subscription } = useSubscription();
  const status = subscription?.status;
  // past_due keeps the paid allowance while dunning runs, matching the guard.
  const plan: Plan =
    status === "active" || status === "trialing" || status === "past_due" ? status : "free";

  return useQuery<UsageSummary>({
    queryKey: ["ai-usage", plan],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_usage_events")
        .select("operation")
        .eq("decision", "allowed")
        .gte("created_at", monthStart().toISOString());
      // A missing table or a transient failure should not put a scary zero
      // or an error state in front of someone. Report the allowance as
      // untouched; the server is the thing that actually enforces it.
      if (error) return summarize(0, plan);
      return summarize(weighted((data ?? []) as Array<{ operation: string }>), plan);
    },
    staleTime: 30_000,
  });
}
