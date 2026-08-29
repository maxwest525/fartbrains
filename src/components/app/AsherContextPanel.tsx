import { useCallback, useEffect, useState } from "react";
import { Loader2, X, BrainCircuit, Library, FileText, Quote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AsherContext = {
  systemPrompt: string;
  instructions: string;
  ideaContext: string;
  vaultContext: string;
  hits: Array<{
    id: string;
    title: string;
    tags: string[];
    snippet: string;
    score: number;
    matchedTerms?: string[];
    reason?: string;
  }>;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Renders text with each matched query term visually highlighted. */
const Highlighted = ({ text, terms }: { text: string; terms: string[] }) => {
  const clean = (terms ?? []).filter((t) => t.trim().length > 1);
  if (clean.length === 0) return <>{text}</>;
  const re = new RegExp(`(${clean.map(escapeRe).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        clean.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
          <mark
            key={i}
            className="bg-primary/25 text-foreground rounded px-0.5 font-medium"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
};

type Props = {
  query: string;
  ideaId?: string;
  onClose: () => void;
};

/**
 * Shows exactly what Asher will receive for the next response: the user's
 * personal instructions, the idea in focus, and the retrieved vault context.
 */
export const AsherContextPanel = ({ query, ideaId, onClose }: Props) => {
  const [data, setData] = useState<AsherContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asher-context`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ query, ideaId: ideaId ?? null }),
        },
      );
      if (!res.ok) throw new Error(`Preview failed (${res.status})`);
      setData((await res.json()) as AsherContext);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the preview");
    } finally {
      setLoading(false);
    }
  }, [query, ideaId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background/85 backdrop-blur-2xl">
      <div className="safe-top shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-foreground/60">
            Next response context
          </div>
          <div className="text-[14px] font-medium truncate">
            {query.trim() ? query.trim().slice(0, 60) : "No question typed yet"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="press h-9 w-9 flex items-center justify-center text-foreground/70"
          aria-label="Close context preview"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5 pb-24">
        {loading ? (
          <div className="flex items-center gap-2 text-foreground/70 text-sm py-10 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Building preview…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-[13.5px]">
            <p className="mb-2">{error}</p>
            <button onClick={() => void load()} className="press text-primary text-[13.5px]">
              Try again
            </button>
          </div>
        ) : data ? (
          <>
            <section>
              <div className="flex items-center gap-1.5 mb-2 text-[12px] uppercase tracking-[0.12em] text-foreground/60">
                <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                Your instructions
              </div>
              {data.instructions.trim() ? (
                <pre className="whitespace-pre-wrap text-[13px] leading-relaxed rounded-2xl border border-white/15 bg-white/[0.06] p-3">
                  {data.instructions}
                </pre>
              ) : (
                <p className="text-[13px] text-foreground/65">
                  No personal instructions set yet — Asher is running on defaults.
                </p>
              )}
            </section>

            {data.ideaContext.trim() && (
              <section>
                <div className="flex items-center gap-1.5 mb-2 text-[12px] uppercase tracking-[0.12em] text-foreground/60">
                  <FileText className="h-3.5 w-3.5 text-accent" />
                  Idea in focus
                </div>
                <pre className="whitespace-pre-wrap text-[13px] leading-relaxed rounded-2xl border border-white/15 bg-white/[0.06] p-3">
                  {data.ideaContext}
                </pre>
              </section>
            )}

            <section>
              <div className="flex items-center gap-1.5 mb-2 text-[12px] uppercase tracking-[0.12em] text-foreground/60">
                <Library className="h-3.5 w-3.5 text-accent" />
                Retrieved from your vault ({data.hits.length})
              </div>
              {data.hits.length === 0 ? (
                <p className="text-[13px] text-foreground/65">
                  Nothing else in your vault matched this question.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.hits.map((h) => (
                    <li
                      key={h.id}
                      className="rounded-2xl border border-white/15 bg-white/[0.06] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[14px] font-medium leading-snug">
                          <Highlighted text={h.title} terms={h.matchedTerms ?? []} />
                        </span>
                        <span className="text-[11px] text-foreground/55 shrink-0 mt-0.5">
                          {h.score}
                        </span>
                      </div>
                      {h.tags.length > 0 && (
                        <div className="text-[11.5px] text-foreground/60 mt-0.5">
                          <Highlighted
                            text={h.tags.map((t) => `#${t}`).join(" ")}
                            terms={h.matchedTerms ?? []}
                          />
                        </div>
                      )}
                      {h.reason && (
                        <div className="flex items-start gap-1.5 mt-1.5 text-[11.5px] text-primary/90">
                          <Quote className="h-3 w-3 mt-0.5 shrink-0" />
                          <span>Selected because {h.reason}</span>
                        </div>
                      )}
                      {h.snippet && (
                        <p className="text-[13px] text-foreground/75 leading-snug mt-1.5">
                          <Highlighted text={h.snippet} terms={h.matchedTerms ?? []} />
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="press text-[13px] text-primary"
              >
                {showRaw ? "Hide raw system prompt" : "Show raw system prompt"}
              </button>
              {showRaw && (
                <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed rounded-2xl border border-white/15 bg-white/[0.04] p-3 text-foreground/80">
                  {data.systemPrompt}
                </pre>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
};
