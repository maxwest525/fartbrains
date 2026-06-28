import { Loader2 } from "lucide-react";

type Props = {
  active: boolean;
  className?: string;
  label?: string;
};

/**
 * Compact loading indicator shown while an AI summary/spec is being generated.
 * Just a smooth rotating spinner with a short label — no scrolling text.
 */
export const ThinkingPanel = ({ active, className, label = "Generating summary" }: Props) => {
  if (!active) return null;

  return (
    <div
      className={`rounded-xl glass-card-quiet p-3 flex items-center gap-3 ${className ?? ""}`}
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-4 w-4 text-accent animate-spin shrink-0" />
      <span className="text-[12.5px] font-medium text-foreground/85">{label}…</span>
    </div>
  );
};
