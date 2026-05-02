import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, CheckCircle2, ClipboardPaste, FileText, Loader2, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFolders } from "@/hooks/useFolders";
import { useCreateIdea } from "@/hooks/useIdeas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NO_FOLDER = "__none__";
const MIN_CHARS = 20;
const RECOMMENDED_CHARS = 400;
const MAX_CHARS = 100_000;

type Props = {
  defaultFolderId?: string | null;
  onBack: () => void;
  /** Called after a successful save. `needsReview` opens the detail panel for edits. */
  onCreated: (ideaId: string, needsReview: boolean) => void;
};

/**
 * Dedicated paste-transcript screen.
 *
 * Skips the source picker and lands the user directly on a large textarea.
 * On submit, calls the `summarize` edge function, then saves an idea with
 * both the verbatim transcript (extracted_text) and AI summary populated.
 */
export const TranscriptCapture = ({ defaultFolderId, onBack, onCreated }: Props) => {
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();

  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [folder, setFolder] = useState<string>(defaultFolderId ?? NO_FOLDER);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus the textarea on mount so the user can paste immediately.
  useEffect(() => {
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    setFolder(defaultFolderId ?? NO_FOLDER);
  }, [defaultFolderId]);

  const trimmed = text.trim();
  const charCount = trimmed.length;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const overLimit = charCount > MAX_CHARS;
  const tooShort = charCount > 0 && charCount < MIN_CHARS;
  const isEmpty = charCount === 0;
  const meetsRecommended = charCount >= RECOMMENDED_CHARS;
  const progress = Math.min(100, Math.round((charCount / RECOMMENDED_CHARS) * 100));
  const canSave = charCount >= MIN_CHARS && !overLimit && !busy;

  const validationState: "empty" | "short" | "over" | "ok" | "great" =
    isEmpty ? "empty" : tooShort ? "short" : overLimit ? "over" : meetsRecommended ? "great" : "ok";

  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        toast.info("Clipboard is empty");
        return;
      }
      setText((prev) => (prev ? `${prev}\n\n${clip}` : clip));
      toast.success("Pasted from clipboard");
    } catch {
      toast.error("Couldn't read clipboard. Paste manually with Cmd/Ctrl+V.");
    }
  };

  const handleSubmit = async () => {
    if (!canSave) return;
    const transcript = text.trim();
    setBusy(true);

    try {
      let summary = "";
      let aiTitle: string | undefined;
      try {
        const { data, error } = await supabase.functions.invoke("summarize", {
          body: { text: transcript, kind: "transcript", userNote: note.trim() || undefined },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        summary = (data?.summary ?? "").toString();
        aiTitle = data?.suggestedTitle ?? undefined;
      } catch (e) {
        toast.warning(e instanceof Error ? `AI summary failed: ${e.message}` : "AI summary failed");
      }

      const finalTitle = (
        aiTitle ||
        transcript.split("\n").find((l) => l.trim())?.slice(0, 80) ||
        "Untitled transcript"
      ).slice(0, 200);

      const idea = await createIdea.mutateAsync({
        title: finalTitle,
        raw_note: note.trim() || null,
        source_url: null,
        source_type: "transcript",
        extracted_text: transcript,
        ai_summary: summary.trim() || null,
        folder_id: folder === NO_FOLDER ? null : folder,
        tags: [],
      });

      const summaryClean = summary.trim();
      const hasMainIdea = /\*\*Main idea:\*\*/i.test(summaryClean);
      const needsReview = !summaryClean || summaryClean.length < 150 || !hasMainIdea;

      if (!needsReview) {
        toast.success("Transcript saved", {
          description: "Find it in Recents or the All folder.",
        });
      }
      setText("");
      setNote("");
      onCreated(idea.id, needsReview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex-1 min-w-0 flex flex-col min-h-0 bg-background">
      {/* Header — sticky on mobile so Back stays reachable while scrolling */}
      <div className="safe-top sticky top-0 z-10 bg-background/85 backdrop-blur-xl border-b border-border/60 px-3 sm:px-6 lg:px-10 py-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-9 -ml-2 gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="ml-1 text-[15px] font-semibold truncate sm:hidden">Paste a transcript</div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum touch-pan-y pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-6">
        <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 lg:px-10 pt-3 sm:pt-2 pb-4">
          {/* Title block — desktop/tablet only; mobile uses the sticky header title */}
          <div className="mb-4 hidden sm:block">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Paste a transcript</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Drop in a video transcript, podcast notes, meeting notes, or any long text.
              We'll summarize it and save it as an idea.
            </p>
          </div>
          <p className="mb-3 text-[13px] text-muted-foreground sm:hidden">
            Drop in a transcript or long text. We'll summarize it and save it as an idea.
          </p>

          {/* Toolbar — stacks on mobile so the folder picker has room */}
          <div className="mb-2 flex flex-col sm:flex-row sm:items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={pasteFromClipboard}
              disabled={busy}
              className="h-10 sm:h-9 gap-1.5 w-full sm:w-auto justify-center"
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste from clipboard
            </Button>
            <Select value={folder} onValueChange={setFolder} disabled={busy}>
              <SelectTrigger className="h-10 sm:h-9 w-full sm:w-auto sm:min-w-[10rem] text-sm">
                <SelectValue placeholder="No folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FOLDER}>No folder</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Textarea with empty-state overlay hint */}
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the transcript here…"
              rows={12}
              aria-invalid={tooShort || overLimit}
              aria-describedby="transcript-validation"
              maxLength={MAX_CHARS + 1000}
              className={`min-h-[35vh] sm:min-h-[50vh] text-[15px] leading-relaxed resize-y ${
                tooShort || overLimit ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
              disabled={busy}
            />

            {isEmpty && !busy && (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4">
                <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-3 sm:p-4 text-xs sm:text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 font-medium text-foreground/80">
                    <Lightbulb className="h-4 w-4" />
                    Tips for a good summary
                  </div>
                  <ul className="mt-2 space-y-1 list-disc list-inside marker:text-muted-foreground/60">
                    <li>Paste the full transcript, not a snippet</li>
                    <li>Include speaker names if available</li>
                    <li className="hidden sm:list-item">
                      Aim for at least {RECOMMENDED_CHARS.toLocaleString()} characters for a richer summary
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {busy && (
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70 backdrop-blur-[2px]">
                <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Generating AI summary…
                </div>
              </div>
            )}
          </div>

          {/* Progress + counters */}
          <div className="mt-3 space-y-2">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all duration-300 ${
                  overLimit
                    ? "bg-destructive"
                    : tooShort
                    ? "bg-destructive/70"
                    : meetsRecommended
                    ? "bg-primary"
                    : "bg-primary/60"
                }`}
                style={{ width: `${overLimit ? 100 : progress}%` }}
              />
            </div>

            <div
              id="transcript-validation"
              className="flex items-start gap-1.5 text-xs min-h-[1rem]"
              role="status"
              aria-live="polite"
            >
              {validationState === "empty" && (
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Waiting for text — paste or type to get started.
                </span>
              )}
              {validationState === "short" && (
                <span className="text-destructive inline-flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Too short — add at least {MIN_CHARS - charCount} more character
                  {MIN_CHARS - charCount === 1 ? "" : "s"} to summarize.
                </span>
              )}
              {validationState === "ok" && (
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Looks good. {RECOMMENDED_CHARS - charCount} more chars recommended for a stronger summary.
                </span>
              )}
              {validationState === "great" && (
                <span className="text-primary inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ready to summarize.
                </span>
              )}
              {validationState === "over" && (
                <span className="text-destructive inline-flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Over the {MAX_CHARS.toLocaleString()}-character limit. Trim {(charCount - MAX_CHARS).toLocaleString()} chars.
                </span>
              )}
            </div>

            <div className="text-xs text-muted-foreground tabular-nums">
              <span className={overLimit ? "text-destructive font-medium" : ""}>
                {charCount.toLocaleString()}
              </span>
              {" / "}
              {MAX_CHARS.toLocaleString()} chars · {wordCount.toLocaleString()} words
            </div>
          </div>

          {/* Desktop/tablet actions — mobile uses the sticky bar below */}
          <div className="mt-4 hidden sm:flex items-center justify-end gap-2">
            {text && !busy && (
              <Button variant="ghost" size="sm" onClick={() => setText("")} className="h-10">
                Clear
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!canSave}
              className="h-10 gap-1.5 min-w-[10rem]"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Summarizing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Summarize & save
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile sticky action bar — keeps Save reachable without scrolling past a long textarea */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-20 bg-background/90 backdrop-blur-xl border-t border-border safe-bottom">
        <div className="px-3 py-2 flex items-center gap-2">
          {text && !busy && (
            <Button variant="ghost" size="sm" onClick={() => setText("")} className="h-11 px-3">
              Clear
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!canSave}
            className="h-11 flex-1 gap-1.5"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Summarizing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Summarize & save
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
