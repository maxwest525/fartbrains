import { useState } from "react";
import { Globe, Microscope, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThinkingPanel } from "./ThinkingPanel";

type Props = {
  ideaTitle: string;
  /** Append a fenced markdown block to the idea's extracted_text + return the merged value to save. */
  onAppendExtracted: (block: string) => Promise<void>;
  /** When set (idea has no summary yet), use the deep-research report as the new summary. */
  onSetSummaryIfEmpty?: (markdown: string) => Promise<void>;
};

/**
 * Research dock for an idea — Deep Research (Firecrawl search → Gemini synthesis)
 * and Scrape URL (Firecrawl scrape → markdown + AI summary). Both append their
 * output to the idea's "extracted text" so it shows up in the detail view.
 */
export const IdeaResearchActions = ({ ideaTitle, onAppendExtracted, onSetSummaryIfEmpty }: Props) => {
  const [mode, setMode] = useState<"none" | "research" | "scrape">("none");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"research" | "scrape" | null>(null);

  const openResearch = () => {
    setMode("research");
    setQuery((q) => q || ideaTitle);
  };
  const openScrape = () => setMode("scrape");

  const runResearch = async () => {
    const q = query.trim();
    if (q.length < 3) {
      toast.error("Type a research question first.");
      return;
    }
    setBusy("research");
    try {
      const { data, error } = await supabase.functions.invoke("deep-research", {
        body: { query: q, context: ideaTitle },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const report: string = data?.report ?? "";
      if (!report) throw new Error("Empty report");
      const block = `\n\n---\n## Deep research — ${q}\n_${new Date().toLocaleString()}_\n\n${report}\n`;
      await onAppendExtracted(block);
      if (onSetSummaryIfEmpty) await onSetSummaryIfEmpty(report);
      toast.success("Research added", { description: `${data?.sources?.length ?? 0} sources synthesized.` });
      setMode("none");
      setQuery("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Research failed");
    } finally {
      setBusy(null);
    }
  };

  const runScrape = async () => {
    const u = url.trim();
    if (!u) {
      toast.error("Paste a URL first.");
      return;
    }
    setBusy("scrape");
    try {
      const { data, error } = await supabase.functions.invoke("scrape-url", {
        body: { url: u },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const title = data?.title ?? u;
      const summary = data?.summary ?? "";
      const markdown = data?.markdown ?? "";
      const block = `\n\n---\n## Scraped — ${title}\n[${u}](${u}) · _${new Date().toLocaleString()}_\n\n${
        summary ? `**Summary:** ${summary}\n\n` : ""
      }${markdown}\n`;
      await onAppendExtracted(block);
      toast.success("Scrape added", { description: title });
      setMode("none");
      setUrl("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Microscope className="h-3.5 w-3.5 text-primary" /> Research
        </h3>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={openResearch}
            disabled={busy !== null}
          >
            <Microscope className="h-3.5 w-3.5 mr-1" />
            Deep research
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
            onClick={openScrape}
            disabled={busy !== null}
          >
            <Globe className="h-3.5 w-3.5 mr-1" />
            Scrape URL
          </Button>
        </div>
      </div>

      {mode === "research" && (
        <div className="rounded-xl glass-card-quiet p-3 space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What should I research?"
            disabled={busy !== null}
            onKeyDown={(e) => {
              if (e.key === "Enter") runResearch();
            }}
            autoFocus
          />
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setMode("none")} disabled={busy !== null}>
              Cancel
            </Button>
            <Button size="sm" onClick={runResearch} disabled={busy !== null}>
              {busy === "research" ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Researching…</>
              ) : (
                "Run"
              )}
            </Button>
          </div>
        </div>
      )}

      {mode === "scrape" && (
        <div className="rounded-xl glass-card-quiet p-3 space-y-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            inputMode="url"
            disabled={busy !== null}
            onKeyDown={(e) => {
              if (e.key === "Enter") runScrape();
            }}
            autoFocus
          />
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setMode("none")} disabled={busy !== null}>
              Cancel
            </Button>
            <Button size="sm" onClick={runScrape} disabled={busy !== null}>
              {busy === "scrape" ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Scraping…</>
              ) : (
                "Run"
              )}
            </Button>
          </div>
        </div>
      )}

      <ThinkingPanel active={busy !== null} className="mt-2" />
    </section>
  );
};
