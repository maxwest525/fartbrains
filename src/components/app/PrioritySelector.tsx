import { cn } from "@/lib/utils";
import type { Priority } from "@/hooks/useIdeas";

const LEVELS: { key: Priority; label: string; dot: string; ring: string }[] = [
  { key: "none",   label: "None",   dot: "bg-muted-foreground/40", ring: "ring-muted-foreground/30" },
  { key: "low",    label: "Low",    dot: "bg-primary/70",          ring: "ring-primary/50" },
  // iOS systemOrange-ish using accent token
  { key: "medium", label: "Medium", dot: "bg-accent",              ring: "ring-accent/60" },
  { key: "high",   label: "High",   dot: "bg-destructive",         ring: "ring-destructive/60" },
];

type Props = {
  value: Priority;
  onChange: (next: Priority) => void;
  disabled?: boolean;
};

/**
 * Segmented priority selector — None / Low / Medium / High with colored dots.
 * Pure metadata; doesn't influence the AI prompt.
 */
export const PrioritySelector = ({ value, onChange, disabled }: Props) => {
  return (
    <div
      role="radiogroup"
      aria-label="Priority"
      className="inline-flex items-center gap-1 rounded-full bg-secondary/60 p-1"
    >
      {LEVELS.map((lvl) => {
        const active = value === lvl.key;
        return (
          <button
            key={lvl.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(lvl.key)}
            className={cn(
              "press flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm ring-1 " + lvl.ring
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", lvl.dot)} />
            {lvl.label}
          </button>
        );
      })}
    </div>
  );
};
