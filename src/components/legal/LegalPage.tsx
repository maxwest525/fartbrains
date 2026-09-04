import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft } from "lucide-react";

type Props = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

/**
 * Shared shell for the public legal pages.
 *
 * The WIP banner is not decoration: these are unreviewed drafts, and shipping
 * them without saying so would itself be a misleading claim. Remove the banner
 * only when a lawyer has signed the text off.
 */
export const LegalPage = ({ title, lastUpdated, children }: Props) => {
  // The site is indexable, but these drafts are not reviewed and must not be
  // the version of our policy that search engines surface. Remove this once a
  // lawyer has signed the text off — and remove the banner at the same time.
  useEffect(() => {
    const tag = document.createElement("meta");
    tag.name = "robots";
    tag.content = "noindex,nofollow";
    document.head.appendChild(tag);
    return () => { tag.remove(); };
  }, []);

  return (
  <main className="min-h-dvh bg-background text-foreground">
    <header className="border-b border-border/60 px-5 py-3 flex items-center gap-3">
      <Link to="/" className="text-sm text-primary inline-flex items-center gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <span className="ml-auto text-[11px] text-muted-foreground">Fartbrains</span>
    </header>

    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <div
        role="note"
        className="mb-8 rounded-xl border border-[hsl(38_92%_50%/0.4)] bg-[hsl(38_92%_50%/0.08)] px-4 py-3 flex gap-3"
      >
        <AlertTriangle className="h-5 w-5 shrink-0 text-[hsl(38_92%_45%)]" />
        <div className="text-[13px] leading-snug">
          <p className="font-semibold">Work in progress — draft, not final</p>
          <p className="text-muted-foreground mt-0.5">
            This is an unreviewed placeholder written to have something in
            place. It has not been checked by a lawyer and is not legal advice.
            Do not rely on it, and replace it before taking real customers.
          </p>
        </div>
      </div>

      <h1 className="text-2xl font-semibold mb-1">{title}</h1>
      <p className="text-[12px] text-muted-foreground mb-8">
        Draft last updated {lastUpdated}
      </p>

      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:mt-8 prose-headings:mb-2">
        {children}
      </div>

      <footer className="mt-12 pt-4 border-t border-border/60 flex gap-4 text-[12px] text-muted-foreground">
        <Link to="/privacy" className="text-primary">Privacy</Link>
        <Link to="/terms" className="text-primary">Terms</Link>
      </footer>
    </div>
  </main>
  );
};
