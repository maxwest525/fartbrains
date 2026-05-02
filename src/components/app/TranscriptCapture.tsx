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
          body: { text: transcript, kind: "transcript" },
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
        raw_note: null,
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
      onCreated(idea.id, needsReview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex-1 min-w-0 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="px-3 sm:px-6 lg:px-10 pt-3 sm:pt-5 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-9 -ml-2 gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum touch-pan-y pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-6">
        <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 lg:px-10 pt-2 pb-6">
          {/* Title block */}
          <div className="mb-4">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Paste a transcript</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Drop in a video transcript, podcast notes, meeting notes, or any long text.
              We'll summarize it and save it as an idea.
            </p>
          </div>

          {/* Toolbar */}
          <div className="mb-2 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={pasteFromClipboard}
              disabled={busy}
              className="h-9 gap-1.5"
            >
              <ClipboardPaste className="h-4 w-4" />
              Paste
            </Button>
            <Select value={folder} onValueChange={setFolder} disabled={busy}>
              <SelectTrigger className="h-9 w-auto min-w-[10rem] text-sm">
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

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the transcript here…"
            rows={16}
            className="min-h-[40vh] sm:min-h-[50vh] text-[15px] leading-relaxed resize-y"
            disabled={busy}
          />

          {/* Meta + actions */}
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {charCount.toLocaleString()} chars · {wordCount.toLocaleString()} words
              {charCount > 0 && charCount < MIN_CHARS && (
                <span className="ml-2 text-destructive">
                  Need at least {MIN_CHARS} characters
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
};
