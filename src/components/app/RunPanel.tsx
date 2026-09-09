import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Play, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { RunProgress } from "./RunProgress";
import {
  begin,
  complete,
  createRun,
  fail,
  skip,
  type Run,
} from "@/lib/runPipeline";
import { functionErrorMessage } from "@/lib/functionError";
import {
  DESCRIPTIONS,
  LABELS,
  shouldConfirm,
  suggestOutputKind,
  type OutputKind,
} from "@/lib/outputKind";

/**
 * The loop.
 *
 * You say what you want out of the thing you saved — "make this but for
 * Instagram too" — and watch it research, then build. What comes back can be
 * copied straight into whatever agent you already use, or run again with a
 * correction, which is the part that makes the output good.
 *
 * Research and compose are chained here rather than left as two buttons
 * because that sequencing is the product: the research exists to make the
 * output better, and asking someone to remember to do it first means they
 * won't.
 */

const KINDS: OutputKind[] = ["spec", "mvp", "agent", "skill", "playbook"];

type Props = {
  ideaTitle: string;
  transcript?: string | null;
  /** What the person typed. For a plain note this is the only material there is. */
  note?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  className?: string;
};

export const RunPanel = ({ ideaTitle, transcript, note, summary, tags, className }: Props) => {
  const [intent, setIntent] = useState("");
  const [override, setOverride] = useState<OutputKind | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const suggestion = useMemo(
    () => suggestOutputKind({ intent, tags }),
    [intent, tags],
  );
  const kind = override ?? suggestion.kind;
  // Ask before spending the expensive step on a guess. Once someone has picked,
  // stop asking — they answered.
  const asking = override === null && shouldConfirm(suggestion);

  /** Everything we could hand the model, so the UI can say when there is nothing. */
  const material = [transcript, note, summary]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
  const hasMaterial = material.length >= 40;

  const go = async () => {
    if (busy) return;
    setBusy(true);
    setOutput(null);

    // The material is already captured, so this run starts at research. Showing
    // "Transcribing" again for work that happened yesterday would be theatre.
    let r = createRun("text");
    r = complete(begin(r, "detect"), "detect", LABELS[kind]);
    setRun(r);

    let research = "";

    // Research is optional: if it fails, the output is thinner but it still
    // gets built. Losing the run because a web search 500'd would be absurd.
    r = begin(r, "research");
    setRun(r);
    try {
      const { data, error } = await supabase.functions.invoke("deep-research", {
        body: { query: intent.trim() || ideaTitle, context: ideaTitle },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      research = data?.report ?? "";
      r = research
        ? complete(r, "research", `${research.trim().split(/\s+/).length.toLocaleString()} words`)
        : skip(r, "research", "nothing came back");
    } catch (e) {
      r = fail(r, "research", e instanceof Error ? e.message : "research failed");
    }
    setRun(r);

    r = begin(r, "compose");
    setRun(r);
    try {
      const { data, error } = await supabase.functions.invoke("compose-output", {
        body: { kind, intent, title: ideaTitle, transcript: material, note, summary, research },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const text: string = data?.output ?? "";
      if (!text) throw new Error("Came back empty");
      setOutput(text);
      setRun(complete(r, "compose", LABELS[kind]));
    } catch (e) {
      // Read what the function actually said rather than the generic wrapper.
      const message = await functionErrorMessage(e, "Couldn't build the output");
      setRun(fail(r, "compose", message));
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast.success("Copied — paste it into your agent");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <section className={cn("space-y-2.5", className)}>
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles className="h-3.5 w-3.5 text-primary" /> Make something from this
      </h3>

      <Textarea
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="What do you want out of this? e.g. “make this but for Instagram too”"
        disabled={busy}
        className="min-h-[68px] resize-none text-sm"
      />

      {/* The suggestion is always shown with its reason. A tool that silently
          picks the wrong artifact wastes the most expensive step there is. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setOverride(k)}
            disabled={busy}
            title={DESCRIPTIONS[k]}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50",
              k === kind
                ? "border-primary/50 bg-primary/10 font-medium text-foreground"
                : "border-white/10 text-muted-foreground hover:text-foreground",
            )}
          >
            {LABELS[k]}
          </button>
        ))}
      </div>

      <p className="text-[11.5px] leading-[1.45] text-muted-foreground">
        {asking
          ? `Not sure yet — ${suggestion.reason}. Pick one, or tell it what you want above.`
          : override
            ? DESCRIPTIONS[kind]
            : `${LABELS[kind]} — ${suggestion.reason}.`}
      </p>

      {/* Say so before spending the expensive step. The model cannot build from
          an empty note, and letting someone press the button to find that out is
          how the first real use of this panel went. */}
      {!hasMaterial && (
        <p className="rounded-xl glass-card-quiet p-3 text-[12px] leading-[1.5] text-muted-foreground">
          Nothing to build from yet. Add a note, paste a transcript, or capture a link
          on this idea first.
        </p>
      )}

      {run && <RunProgress run={run} />}

      <div className="flex gap-2">
        <Button
          onClick={go}
          disabled={busy || !hasMaterial}
          className="h-10 flex-1 rounded-xl text-[15px] font-semibold"
        >
          {output ? <RotateCcw className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
          {busy ? "Working…" : output ? "Run again" : `Build the ${LABELS[kind].toLowerCase()}`}
        </Button>
        {output && (
          <Button onClick={copy} variant="outline" className="h-10 rounded-xl px-3" aria-label="Copy output">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {output && (
        <div className="rounded-xl glass-card-quiet p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm prose-headings:font-semibold prose-pre:text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
          </div>
        </div>
      )}

      {output && (
        <p className="text-[11.5px] text-muted-foreground">
          Not right? Say what to change above and run it again — that is the loop.
        </p>
      )}
    </section>
  );
};
