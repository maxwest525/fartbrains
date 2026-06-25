import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Shuffle, ArrowRight, Loader2, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Suggestion = {
  connectedId: string;
  connectedTitle: string;
  headline: string;
  body: string;
};

type Props = {
  ideaId: string;
  onSelect?: (id: string) => void;
};

/**
 * Cross-pollination — picks a random other idea and proposes a creative
 * connection where it could act as a solution/unlock for the current idea.
 * Manually triggered so it doesn't spend credits on every open.
 */
export const CrossPollination = ({ ideaId, onSelect }: Props) => {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [seen, setSeen] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async (): Promise<Suggestion | null> => {
      const { data, error } = await supabase.functions.invoke("cross-pollinate", {
        body: { ideaId, excludeIds: seen },
      });
      if (error) throw error;
      return (data?.suggestion ?? null) as Suggestion | null;
    },
    onSuccess: (s) => {
      if (!s) {
        toast.info("No other ideas to cross-reference yet — capture more.");
        return;
      }
      setSuggestion(s);
      setSeen((prev) => [...prev, s.connectedId].slice(-20));
    },
    onError: (e: any) => toast.error(e?.message ?? "Couldn't generate a suggestion"),
  });

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-primary" />
          Random connection
        </h3>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 rounded-full text-xs gap-1"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Shuffle className="h-3.5 w-3.5" />
          )}
          {suggestion ? "Try another" : "Surprise me"}
        </Button>
      </div>

      {!suggestion && !mutation.isPending && (
        <div className="rounded-xl glass-card-quiet border-dashed p-3 text-xs text-muted-foreground">
          Pull a random idea from your library and let AI propose how it could
          unlock this one.
        </div>
      )}

      {suggestion && (
        <div className="rounded-xl glass-card-quiet p-3 space-y-2">
          <div className="text-sm font-medium leading-snug">{suggestion.headline}</div>
          {suggestion.body && (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {suggestion.body}
            </p>
          )}
          <button
            type="button"
            onClick={() => onSelect?.(suggestion.connectedId)}
            className="group w-full text-left rounded-md border border-border/60 bg-muted/20 hover:bg-muted/40 transition px-2.5 py-2 flex items-center gap-2"
          >
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              via
            </span>
            <span className="text-xs font-medium truncate flex-1">
              {suggestion.connectedTitle}
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
          </button>
        </div>
      )}
    </section>
  );
};
