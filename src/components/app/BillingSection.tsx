import { CreditCard, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useOpenBillingPortal,
  useStartCheckout,
  useSubscription,
} from "@/hooks/useSubscription";
import { STATUS_LABEL, isEntitled, statusMessage } from "@/lib/entitlements";

/**
 * Billing. Shows the real subscription row, never a local flag — the server is
 * what actually enforces entitlements.
 */
export const BillingSection = () => {
  const { data: sub, isLoading } = useSubscription();
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal();

  const status = sub?.status ?? "free";
  const entitled = isEntitled(status);
  const message = sub
    ? statusMessage(status, sub.current_period_end, sub.cancel_at_period_end)
    : null;

  const run = (m: { mutateAsync: (v?: never) => Promise<unknown> }) => async () => {
    try {
      await m.mutateAsync(undefined as never);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Billing isn't available right now.");
    }
  };

  const tone =
    status === "past_due" || status === "unpaid" || status === "incomplete"
      ? "text-destructive"
      : entitled
        ? "text-[hsl(140_70%_35%)]"
        : "text-muted-foreground";

  return (
    <div className="mt-5 rounded-2xl bg-card border border-border/60 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <CreditCard className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Billing</p>
          {isLoading ? (
            <p className="text-[11px] text-muted-foreground mt-0.5">Checking…</p>
          ) : (
            <p className={`text-[11px] mt-0.5 ${tone}`}>{STATUS_LABEL[status]}</p>
          )}
        </div>
      </div>

      {message && (
        <p className="text-[12px] text-muted-foreground mt-2 leading-snug">{message}</p>
      )}

      {status === "canceled" || status === "free" ? (
        <>
          <p className="text-[12px] text-muted-foreground mt-2 leading-snug">
            Everything you've captured stays readable, searchable and exportable
            on the free plan. A subscription covers the AI features — summaries,
            asking your brain, research and transcription.
          </p>
          {/* WIP: draft pricing, see docs/PRICING.md. The real figure comes from
              the Stripe price, so this copy must be updated alongside it. */}
          <div className="mt-3 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pro · draft pricing
            </p>
            <p className="text-[13px] mt-1">
              <span className="font-semibold">$9</span>
              <span className="text-muted-foreground"> / month, or $90 / year</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              1,000 AI actions a month, longer transcripts and bigger pages.
              Free includes 50 AI actions a month and unlimited notes.
            </p>
            <p className="text-[10.5px] text-muted-foreground/80 mt-1.5">
              Pricing is still being finalised and may change before launch.
            </p>
          </div>
        </>
      ) : null}

      <div className="mt-3 flex gap-2">
        {!entitled && (
          <Button
            size="sm"
            className="flex-1 rounded-full"
            onClick={run(checkout)}
            disabled={checkout.isPending}
          >
            {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade"}
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="flex-1 rounded-full"
          onClick={run(portal)}
          disabled={portal.isPending}
        >
          {portal.isPending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Manage billing</>}
        </Button>
      </div>
    </div>
  );
};
