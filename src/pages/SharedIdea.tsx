import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, Link2Off, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/fartbrains-logo.png";

type SharedIdea = {
  title: string;
  note: string | null;
  summary: string | null;
  refs: { title: string | null; url: string }[];
  sharedAt: string | null;
  expiresAt: string | null;
};

type State =
  | { kind: "loading" }
  | { kind: "ok"; idea: SharedIdea }
  | { kind: "unavailable" }
  | { kind: "error" };

/**
 * The recipient's view of one shared idea.
 *
 * Public, read-only and deliberately outside the app shell: there is no
 * navigation into the owner's vault, no account prompt, and nothing here
 * identifies the owner. Revoked, expired and unknown links are reported
 * identically so the page cannot be used to probe which links exist.
 */
const SharedIdea = () => {
  const { token = "" } = useParams();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("resolve-share", {
          body: { token },
        });
        if (cancelled) return;
        if (error || !data || data.status !== "ok") {
          setState({ kind: "unavailable" });
          return;
        }
        setState({ kind: "ok", idea: data.idea as SharedIdea });
      } catch {
        if (!cancelled) setState({ kind: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const copyAll = async () => {
    if (state.kind !== "ok") return;
    const { title, note, summary } = state.idea;
    const text = [title, summary, note].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — the text is on screen anyway */ }
  };

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/60 px-5 py-3 flex items-center gap-2">
        <img src={logo} alt="" className="h-7 w-7 rounded-md" />
        <span className="text-sm font-semibold">Fartbrains</span>
        <span className="ml-auto text-[11px] text-muted-foreground">Shared idea · read only</span>
      </header>

      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        {state.kind === "loading" && (
          <p className="flex items-center gap-2 text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Opening…
          </p>
        )}

        {(state.kind === "unavailable" || state.kind === "error") && (
          <div className="text-center py-16">
            <Link2Off className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-lg font-semibold mb-1">This link isn't available</h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {state.kind === "error"
                ? "Something went wrong opening this link. Try again in a moment."
                : "It may have expired, been revoked by its owner, or never existed. Ask them for a fresh link."}
            </p>
          </div>
        )}

        {state.kind === "ok" && (
          <article>
            <div className="flex items-start gap-3 mb-6">
              <h1 className="flex-1 text-2xl font-semibold leading-tight">
                {state.idea.title}
              </h1>
              <Button variant="outline" size="sm" className="shrink-0" onClick={copyAll}>
                {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                Copy
              </Button>
            </div>

            {state.idea.summary && (
              <section className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Summary
                </h2>
                <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.idea.summary}</ReactMarkdown>
                </div>
              </section>
            )}

            {state.idea.note && (
              <section className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Note
                </h2>
                <div className="prose prose-sm dark:prose-invert max-w-none break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.idea.note}</ReactMarkdown>
                </div>
              </section>
            )}

            {state.idea.refs.length > 0 && (
              <section className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  References
                </h2>
                <ul className="space-y-1.5">
                  {state.idea.refs.map((r) => (
                    <li key={r.url}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow ugc"
                        className="inline-flex items-center gap-1.5 text-sm text-primary break-all"
                      >
                        {r.title || r.url}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <footer className="mt-10 pt-4 border-t border-border/60 text-[11px] text-muted-foreground">
              Shared read-only from a private Fartbrains second brain.
              {state.idea.expiresAt &&
                ` This link expires ${new Date(state.idea.expiresAt).toLocaleDateString()}.`}
            </footer>
          </article>
        )}
      </div>
    </main>
  );
};

export default SharedIdea;
