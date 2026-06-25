import { useMemo, useState } from "react";
import { Globe, Microscope, Loader2, RefreshCw, ChevronDown, X, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThinkingPanel } from "./ThinkingPanel";
import { cn } from "@/lib/utils";

type Props = {
  ideaTitle: string;
  /** Current value of `extracted_text` so we can surface the most recent saved result inline. */
  extractedText?: string | null;
  /** Append a fenced markdown block to the idea's extracted_text. */
  onAppendExtracted: (block: string) => Promise<void>;
  /** When set (idea has no summary yet), use the deep-research report as the new summary. */
  onSetSummaryIfEmpty?: (markdown: string) => Promise<void>;
};

/**
 * Parses the most recent block of a given heading kind out of the
 * idea's extracted_text. Blocks are appended with a leading `---`
 * separator and an H2 header like "## Deep research — …" or "## Scraped — …".
 */
function lastBlock(text: string | null | undefined, heading: "Deep research" | "Scraped") {
  if (!text) return null;
  const re = new RegExp(`##\\s+${heading}\\s+—\\s+([^\\n]+)\\n([\\s\\S]*?)(?=\\n---\\n##\\s|$)`, "g");
  let match: RegExpExecArray | null;
  let last: { title: string; body: string } | null = null;
  while ((match = re.exec(text)) !== null) {
    last = { title: match[1].trim(), body: match[2].trim() };
  }
  return last;
}

const markdownClass =
  "text-sm prose prose-sm dark:prose-invert max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-headings:font-semibold prose-h1:text-base prose-h2:text-sm prose-h3:text-sm prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-foreground prose-a:text-primary prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none";

type SectionProps = {
  icon: "research" | "scrape";
  title: string;
  placeholder: string;
  inputValue: string;
  onInputChange: (v: string) => void;
  onRun: () => void;
  busy: boolean;
  hasResult: boolean;
  result: { title: string; body: string } | null;
  runLabel: string;
  inputMode?: "text" | "url";
};

const ResultBox = ({ result }: { result: { title: string; body: string } }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl glass-card-quiet overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-white/[0.03]"
      >
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Latest result</div>
          <div className="text-sm font-medium truncate">{result.title}</div>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <div
        className={cn(
          "relative px-4 transition-all",
          open ? "max-h-[3000px] pb-4 pt-1" : "max-h-[120px] overflow-hidden pb-0"
        )}
      >
        <div className={markdownClass}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.body}</ReactMarkdown>
        </div>
        {!open && (
          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-1.5 text-[11px] text-muted-foreground hover:text-foreground border-t border-white/5"
      >
        {open ? "Show less" : "Show more"}
      </button>
    </div>
  );
};

const ResearchSection = ({
  icon, title, placeholder, inputValue, onInputChange, onRun, busy, hasResult, result, runLabel, inputMode,
}: SectionProps) => {
  const Icon = icon === "research" ? Microscope : Globe;
  const accent = icon === "research" ? "text-primary" : "text-accent";

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", accent)} /> {title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRun}
          disabled={busy}
          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : hasResult ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <Icon className="h-3.5 w-3.5" />
          )}
          {hasResult ? "Run again" : runLabel}
        </Button>
      </div>

      <div className="space-y-2">
        <Input
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode === "url" ? "url" : undefined}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onRun();
            }
          }}
          className="h-9 text-sm"
        />
        <ThinkingPanel active={busy} />
        {result ? (
          <ResultBox result={result} />
        ) : (
          <div className="rounded-xl glass-card-quiet border-dashed p-4 text-xs text-muted-foreground">
            {icon === "research"
              ? "Run a deep web search and synthesize the findings into the idea."
              : "Paste any URL — we'll scrape it and add the readable content here."}
          </div>
        )}
      </div>
    </section>
  );
};

export const IdeaResearchActions = ({
  ideaTitle, extractedText, onAppendExtracted, onSetSummaryIfEmpty,
}: Props) => {
  const [query, setQuery] = useState(ideaTitle);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"research" | "scrape" | null>(null);

  const lastResearch = useMemo(() => lastBlock(extractedText, "Deep research"), [extractedText]);
  const lastScrape = useMemo(() => lastBlock(extractedText, "Scraped"), [extractedText]);

  const runResearch = async () => {
    const q = query.trim();
    if (q.length < 3) { toast.error("Type a research question first."); return; }
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Research failed");
    } finally {
      setBusy(null);
    }
  };

  const runScrape = async () => {
    const u = url.trim();
    if (!u) { toast.error("Paste a URL first."); return; }
    setBusy("scrape");
    try {
      const { data, error } = await supabase.functions.invoke("scrape-url", { body: { url: u } });
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
      setUrl("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <ResearchSection
        icon="research"
        title="Deep research"
        placeholder="What should I research?"
        inputValue={query}
        onInputChange={setQuery}
        onRun={runResearch}
        busy={busy === "research"}
        hasResult={!!lastResearch}
        result={lastResearch}
        runLabel="Research"
      />
      <ResearchSection
        icon="scrape"
        title="Scrape URL"
        placeholder="https://…"
        inputValue={url}
        onInputChange={setUrl}
        onRun={runScrape}
        busy={busy === "scrape"}
        hasResult={!!lastScrape}
        result={lastScrape}
        runLabel="Scrape"
        inputMode="url"
      />
    </div>
  );
};
