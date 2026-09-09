import { Check, Loader2, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { currentStage, progress, type Run, type Stage } from "@/lib/runPipeline";

/**
 * Watching a run work.
 *
 * The whole appeal of this step is that something is visibly happening to the
 * thing you just pasted — it is being transcribed, the links in the caption are
 * being opened, the web is being searched. A spinner hides all of that, so this
 * shows the stages, what each one found, and how long it took.
 *
 * Finished stages stay on screen rather than collapsing away. The record of
 * what was actually done is the reason to trust the output, and it is the first
 * thing you want when the output is wrong.
 */

const DOT = "h-[18px] w-[18px] shrink-0 rounded-full flex items-center justify-center";

const StageDot = ({ status }: { status: Stage["status"] }) => {
  if (status === "active") {
    return (
      <span className={cn(DOT, "bg-accent/15")}>
        <Loader2 className="h-3 w-3 animate-spin text-accent" />
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className={cn(DOT, "bg-emerald-500/15")}>
        <Check className="h-3 w-3 text-emerald-400" />
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className={cn(DOT, "bg-amber-500/15")}>
        <X className="h-3 w-3 text-amber-400" />
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className={cn(DOT, "bg-white/[0.06]")}>
        <Minus className="h-3 w-3 text-muted-foreground" />
      </span>
    );
  }
  // Pending: an outline, so the shape of the whole run is visible from the
  // start. Knowing there are two steps left is most of what you want to know.
  return <span className={cn(DOT, "border border-white/12")} />;
};

const secs = (stage: Stage): string | null => {
  if (!stage.startedAt || !stage.endedAt) return null;
  const s = (stage.endedAt - stage.startedAt) / 1000;
  return s < 0.1 ? null : s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`;
};

const StageRow = ({ stage }: { stage: Stage }) => {
  const pending = stage.status === "pending";
  const took = secs(stage);
  return (
    <li className="flex items-start gap-2.5 py-[3px]">
      <span className="pt-[1px]">
        <StageDot status={stage.status} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "text-[12.5px] leading-[1.45]",
            pending && "text-muted-foreground/55",
            stage.status === "active" && "font-medium text-foreground",
            (stage.status === "done" || stage.status === "skipped") && "text-foreground/70",
            stage.status === "failed" && "text-amber-300/90",
          )}
        >
          {stage.status === "pending" || stage.status === "active" ? stage.running : stage.done}
        </span>
        {stage.detail && (
          <span className="block truncate text-[11.5px] leading-[1.4] text-muted-foreground">
            {stage.detail}
          </span>
        )}
      </span>
      {took && (
        <span className="pt-[2px] text-[11px] tabular-nums text-muted-foreground/60">{took}</span>
      )}
    </li>
  );
};

export const RunProgress = ({ run, className }: { run: Run; className?: string }) => {
  const pct = Math.round(progress(run) * 100);
  const active = currentStage(run);

  return (
    <div
      className={cn("rounded-xl glass-card-quiet p-3", className)}
      // Only the headline is announced. Reading seven stage rows aloud on every
      // transition is worse than saying what is happening now.
      aria-live="polite"
      aria-busy={run.status === "running"}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] font-medium text-foreground/85">
          {run.status === "failed"
            ? (run.error ?? "Run failed")
            : run.status === "done"
              ? "Done"
              : `${active?.running ?? "Starting"}…`}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{pct}%</span>
      </div>

      <div className="mb-2.5 h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            run.status === "failed" ? "bg-amber-400/70" : "brand-gradient",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="list-none">
        {run.stages.map((stage) => (
          <StageRow key={stage.key} stage={stage} />
        ))}
      </ul>
    </div>
  );
};
