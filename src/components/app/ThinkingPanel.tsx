import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

/**
 * Scrolling "thinking" indicator shown while an AI summary is being generated.
 * Cycles through random combos of phrases so the user feels live progress.
 */
const THINKING = [
  "the structure",
  "key arguments",
  "the narrative arc",
  "supporting evidence",
  "the author's intent",
  "core takeaways",
  "the tone of voice",
  "implicit context",
  "the hook",
  "the conclusion",
  "stylistic patterns",
  "the audience",
  "the call to action",
  "the data points",
];

const SUMMARIZING = [
  "the main idea",
  "the highlights",
  "key quotes",
  "the action items",
  "the open questions",
  "supporting facts",
  "the conclusion",
  "the headline",
  "the framework",
  "next steps",
  "the central thesis",
  "the surprising bits",
];

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

type Props = {
  active: boolean;
  className?: string;
};

export const ThinkingPanel = ({ active, className }: Props) => {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!active) {
      setLines([]);
      return;
    }
    const next = () => {
      const verb = Math.random() < 0.5 ? "Thinking of" : "Now summarizing";
      const word = verb === "Thinking of" ? pick(THINKING) : pick(SUMMARIZING);
      return `${verb} ${word}…`;
    };
    setLines([next(), next(), next()]);
    const id = setInterval(() => {
      setLines((prev) => [...prev.slice(-5), next()]);
    }, 850);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className={`rounded-xl glass-card-quiet p-3 overflow-hidden relative ${className ?? ""}`}
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 text-[12px] font-medium text-foreground/85 mb-1.5">
        <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
        <span>Generating summary</span>
        <span className="ml-auto flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent/80 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-accent/80 animate-bounce" style={{ animationDelay: "120ms" }} />
          <span className="h-1.5 w-1.5 rounded-full bg-accent/80 animate-bounce" style={{ animationDelay: "240ms" }} />
        </span>
      </div>
      <div className="relative h-[72px] overflow-hidden">
        <div className="absolute inset-x-0 top-0 thinking-scroll space-y-1">
          {lines.map((l, i) => (
            <div
              key={`${i}-${l}`}
              className="text-[12.5px] text-muted-foreground font-mono leading-tight truncate"
              style={{ opacity: 0.4 + (i / Math.max(1, lines.length - 1)) * 0.6 }}
            >
              {l}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-[hsl(var(--background))]/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-[hsl(var(--background))]/60 to-transparent" />
      </div>
    </div>
  );
};
