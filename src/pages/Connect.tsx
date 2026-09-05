import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Check, Copy, Plug, ShieldCheck, AlertTriangle } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { connectPrompt, mcpEndpoint } from "@/lib/mcpEndpoint";
import { cn } from "@/lib/utils";

/**
 * Settings → Connect your agent
 *
 * The product is an endpoint you point your own agent at. Until this page
 * existed that endpoint was written down nowhere in the app, so a subscriber
 * had no way to find it except by asking us — which is not a product.
 *
 * Deliberately not a vendor-specific setup wizard. The pitch is one governed
 * endpoint instead of a pile of plugins, and a page that only works if you use
 * one particular client argues against that. So: the address, the line you
 * paste, and what it can reach.
 */

/** What an agent gets once it connects, in the user's terms rather than tool names. */
const CAPABILITIES = [
  "Search everything you have saved, and read any of it",
  "Save new ideas, and capture a link — reel, video or article — with the transcript",
  "Turn something you saved into a build brief it can act on",
  "Work to your standing instructions, folders and tags rather than inventing its own",
  "Add todos and dates, and move things to Trash — never a permanent delete",
];

const CopyButton = ({ value, label }: { value: string; label: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard is blocked in some contexts (insecure origin, permissions).
      // The value is on screen and selectable, so this is a convenience, not
      // the only way through.
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "press shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium",
        copied
          ? "bg-primary/15 text-primary"
          : "bg-secondary/70 hover:bg-secondary text-foreground/80",
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
};

const ConnectInner = () => {
  const endpoint = mcpEndpoint();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border/60">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
          <Link
            to="/"
            className="press -ml-2 p-2 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-[17px] font-semibold tracking-tight">Connect your agent</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-6 safe-bottom">
        <p className="text-[14px] text-foreground/75 leading-relaxed">
          Your vault has an address. Point the AI session you already work in at it, and it can
          read what you have saved and turn it into something it can build from — without you
          installing anything.
        </p>

        {!endpoint ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="text-[13.5px] leading-snug">
              <p className="font-medium">This build has no backend URL configured.</p>
              <p className="text-foreground/70 mt-1">
                Set <code className="text-[12.5px]">VITE_SUPABASE_URL</code> and rebuild. Rather
                than print an address that would not work, this page shows nothing.
              </p>
            </div>
          </div>
        ) : (
          <>
            <section className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                Step 1 — your endpoint
              </h2>
              <div className="rounded-2xl border border-border/60 bg-secondary/30 p-3 flex items-center gap-2">
                <code className="flex-1 min-w-0 text-[12.5px] break-all leading-snug">
                  {endpoint}
                </code>
                <CopyButton value={endpoint} label="Copy the endpoint URL" />
              </div>
              <p className="text-[12.5px] text-foreground/60 px-1 leading-snug">
                Add this as a remote MCP server in whichever assistant you use. The same address
                works everywhere.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                Step 2 — or just tell your session
              </h2>
              <div className="rounded-2xl border border-border/60 bg-secondary/30 p-3 space-y-3">
                <p className="text-[13.5px] leading-relaxed text-foreground/85">
                  {connectPrompt(endpoint)}
                </p>
                <div className="flex justify-end">
                  <CopyButton value={connectPrompt(endpoint)} label="Copy the connect prompt" />
                </div>
              </div>
              <p className="text-[12.5px] text-foreground/60 px-1 leading-snug">
                Paste it into your agent. It will ask you to sign in the first time — that sign-in
                is what ties the connection to your account.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                What it can do once connected
              </h2>
              <ul className="rounded-2xl border border-border/60 divide-y divide-border/60 overflow-hidden">
                {CAPABILITIES.map((c) => (
                  <li key={c} className="flex gap-2.5 px-4 py-3 text-[13.5px] leading-snug">
                    <Plug className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-border/60 bg-secondary/20 p-4 flex gap-3">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-[13px] leading-snug">
                <p className="font-medium text-[13.5px]">It only ever reaches your vault</p>
                <p className="text-foreground/70">
                  Connecting signs you in; the endpoint refuses every request that is not
                  authenticated. Your agent sees your ideas and nothing from any other account.
                </p>
                <p className="text-foreground/70">
                  Nothing runs on your machine and nothing is installed. Your agent asks this
                  endpoint questions — that is the whole surface.
                </p>
                <p className="text-foreground/70">
                  Deletes go to Trash, not away, so a connected agent cannot destroy anything
                  outright.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

const Connect = () => (
  <ProtectedRoute>
    <ConnectInner />
  </ProtectedRoute>
);

export default Connect;
