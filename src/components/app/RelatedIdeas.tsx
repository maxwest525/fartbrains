import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type RelatedItem = { id: string; title: string; reason: string };

type Props = {
  ideaId: string;
  onSelect?: (id: string) => void;
};

/**
 * Related nodes — hybrid recommender (tag overlap + folder/reference signals
 * pre-filtered server-side, then re-ranked by AI for one-line reasoning).
 * Quietly hides itself when there are no meaningful matches.
 */
export const RelatedIdeas = ({ ideaId, onSelect }: Props) => {
  const qc = useQueryClient();
  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["related-ideas", ideaId],
    queryFn: async (): Promise<RelatedItem[]> => {
      const { data, error } = await supabase.functions.invoke("related-ideas", {
        body: { ideaId },
      });
      if (error) throw error;
      return (data?.related ?? []) as RelatedItem[];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isError) return null;

  const Header = ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Related nodes
      </h3>
      <button
        type="button"
        onClick={() => qc.invalidateQueries({ queryKey: ["related-ideas", ideaId] })}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        disabled={isFetching}
        title="Find more related nodes"
      >
        {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Refresh
      </button>
      {children}
    </div>
  );

  if (isLoading) {
    return (
      <section>
        <Header />
        <div className="rounded-md border border-border/60 bg-muted/20 p-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Matching nodes by tags and meaning…
        </div>
      </section>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <section>
      <Header />
      <ul className="space-y-1.5">
        {data.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect?.(item.id)}
              className="group w-full text-left rounded-md border border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border transition p-3 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.title}</div>
                {item.reason && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {item.reason}
                  </div>
                )}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
