import { Gauge } from "lucide-react";
import { useAiUsage } from "@/hooks/useAiUsage";
import { cn } from "@/lib/utils";

/**
 * This month's AI allowance.
 *
 * The limit was enforced server-side long before anything displayed it, so the
 * only way to discover it was to hit it partway through a capture. A meter is
 * not a nicety here: the allowance is weighted, so ten transcriptions cost
 * more than ten notes, and nobody can predict that from the outside.
 *
 * Counted exactly as ai-guard counts it — see lib/aiUsage, whose constants are
 * pinned to the server's by test.
 */
export const AiUsageMeter = () => {
  const { data, isLoading } = useAiUsage();
  if (isLoading || !data) return null;

  const { used, limit, remaining, fraction, resetsAt, low, exhausted } = data;
  const resets = resetsAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Gauge
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            exhausted ? "text-destructive" : low ? "text-amber-500" : "text-muted-foreground",
          )}
        />
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          AI actions this month
        </p>
        <p className="ml-auto text-[12px] tabular-nums">
          <span className="font-semibold">{used}</span>
          <span className="text-muted-foreground"> / {limit}</span>
        </p>
      </div>

      <div
        className="mt-2 h-1.5 rounded-full bg-border/70 overflow-hidden"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label="AI actions used this month"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            exhausted ? "bg-destructive" : low ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>

      <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
        {exhausted
          ? `You've used this month's allowance. It resets ${resets} — saving, searching and exporting keep working in the meantime.`
          : low
            ? `${remaining} left. Resets ${resets}.`
            : `${remaining} left, resetting ${resets}. Transcription and research count for more than a note.`}
      </p>
    </div>
  );
};
