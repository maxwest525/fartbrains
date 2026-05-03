import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, Sparkles, Inbox, Folder as FolderIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useFolders, useCreateFolder } from "@/hooks/useFolders";
import { useCreateIdea } from "@/hooks/useIdeas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NO_FOLDER = "__none__";

type Props = {
  defaultFolderId?: string | null;
  onBack: () => void;
  onCreated?: (id: string, needsReview?: boolean) => void;
};

/**
 * Full-screen, focused transcript capture. Opened from the Transcript tile in
 * the composer. Provides a large editor, folder picker, and a single
 * "Summarize & save" action. iOS-style nav bar with a Back button returns the
 * user to the standard capture screen.
 */
export const TranscriptCaptureScreen = ({ defaultFolderId, onBack, onCreated }: Props) => {
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();
  const createFolder = useCreateFolder();

  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<string>(defaultFolderId ?? NO_FOLDER);
  const [generating, setGenerating] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    setFolder(defaultFolderId ?? NO_FOLDER);
  }, [defaultFolderId]);

  const folderOrNull = (v: string) => (v === NO_FOLDER ? null : v);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const created = await createFolder.mutateAsync(name);
      setFolder(created.id);
      setNewFolderName("");
      setNewFolderOpen(false);
    } catch {
      // toast handled in the hook
    }
  };

  const handleSave = async () => {
    if (generating) return;
    const trimmed = note.trim();
    if (trimmed.length < 20) {
      return toast.error("Paste at least a few sentences");
    }

    setGenerating(true);
    try {
      let summary = "";
      let aiTitle: string | undefined;
      try {
        const { data: sum, error: sumErr } = await supabase.functions.invoke("summarize", {
          body: { text: trimmed, kind: "transcript" },
        });
        if (sumErr) throw new Error(sumErr.message);
        if (sum?.error) throw new Error(sum.error);
        summary = sum?.summary ?? "";
        aiTitle = sum?.suggestedTitle ?? undefined;
      } catch (e) {
        toast.warning(e instanceof Error ? `AI summary failed: ${e.message}` : "AI summary failed");
      }

      const finalTitle = (
        title.trim() || aiTitle || trimmed.split("\n")[0]?.slice(0, 80) || "Untitled idea"
      ).slice(0, 200);

      const idea = await createIdea.mutateAsync({
        title: finalTitle,
        // Keep the user's original text as the visible "Note" so it stays
        // front-and-center after the AI summary lands (in detail + list preview).
        raw_note: trimmed,
        source_url: null,
        source_type: "transcript",
        extracted_text: trimmed,
        ai_summary: summary.trim() || null,
        folder_id: folderOrNull(folder),
        tags: [],
      });

      const summaryClean = summary.trim();
      const needsReview = !summaryClean || summaryClean.length < 150;
      if (needsReview) {
        toast.message("Saved — needs a quick review", {
          description: "AI wasn't fully confident, so we opened the idea for you to edit.",
        });
      }
      onCreated?.(idea.id, needsReview);
      onBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save idea");
    } finally {
      setGenerating(false);
    }
  };

  const charCount = note.trim().length;
  const wordCount = note.trim() ? note.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col anim-slide-in">
      {/* iOS-style nav bar */}
      <div className="safe-top sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-1 sm:px-4 py-1 sm:py-2 border-b border-border flex items-center gap-1 min-h-[44px]">
        <button
          onClick={onBack}
          className="press flex items-center text-primary -ml-1 pl-1 pr-2 h-10 text-[17px]"
          aria-label="Back to capture"
        >
          <ChevronLeft className="h-6 w-6 -mr-0.5 shrink-0" strokeWidth={2.4} />
          <span className="font-normal">Back</span>
        </button>
        <div className="flex-1 text-center text-[15px] font-semibold truncate px-2">
          Transcript
        </div>
        <div className="w-[72px] shrink-0" />
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum touch-pan-y px-4 sm:px-6 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] space-y-4 max-w-3xl mx-auto w-full">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            Title (optional)
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="AI will suggest one if you leave this blank"
            maxLength={200}
            className="h-12 rounded-xl bg-secondary/60 border-transparent text-[16px]"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Transcript or long text
            </label>
            <span className="text-[11.5px] text-muted-foreground">
              {charCount.toLocaleString()} chars · {wordCount.toLocaleString()} words
            </span>
          </div>
          <Textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Paste a transcript, video caption, or any long text…"
            className="rounded-2xl bg-secondary/60 border-transparent text-[16px] px-4 py-3 leading-relaxed resize-none placeholder:text-muted-foreground/70 min-h-[40vh]"
          />
        </div>

        {/* Folder picker */}
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            Save to
          </label>
          {newFolderOpen && (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateFolder();
                  } else if (e.key === "Escape") {
                    setNewFolderOpen(false);
                    setNewFolderName("");
                  }
                }}
                placeholder="New folder name"
                className="h-11 rounded-xl bg-secondary/60 border-transparent text-[15px] flex-1"
                maxLength={60}
              />
              <Button
                type="button"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || createFolder.isPending}
                className="h-11 rounded-xl px-4"
              >
                {createFolder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setNewFolderOpen(false);
                  setNewFolderName("");
                }}
                className="h-11 rounded-xl px-3"
              >
                Cancel
              </Button>
            </div>
          )}
          <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 no-scrollbar scroll-momentum">
            <button
              type="button"
              onClick={() => setFolder(NO_FOLDER)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium border transition-colors press",
                folder === NO_FOLDER
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/60 text-muted-foreground border-transparent hover:text-foreground"
              )}
            >
              <Inbox className="h-3.5 w-3.5" />
              All
            </button>
            {folders.map((f) => {
              const active = folder === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFolder(f.id)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium border transition-colors press max-w-[160px]",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/60 text-muted-foreground border-transparent hover:text-foreground"
                  )}
                  title={f.name}
                >
                  <FolderIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setNewFolderOpen(true)}
              className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium border border-dashed border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors press"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="sticky bottom-0 left-0 right-0 border-t border-border bg-background/90 backdrop-blur-xl px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto">
          <Button
            type="button"
            onClick={handleSave}
            disabled={generating || charCount < 20}
            className="w-full h-12 rounded-xl text-[16px] font-semibold"
          >
            {generating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Summarize &amp; save
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
