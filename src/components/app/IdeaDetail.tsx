import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Star, Trash2, ExternalLink, Sparkles, ChevronLeft, Wand2, Copy, Check, Loader2, RefreshCw, Bell, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIdea, useUpdateIdea, useDeleteIdea } from "@/hooks/useIdeas";
import { useFolders } from "@/hooks/useFolders";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PrioritySelector } from "./PrioritySelector";
import { IdeaReminderDialog } from "./IdeaReminderDialog";
import { ProjectBoard } from "./ProjectBoard";
import { PROJECT_TAG } from "@/lib/deliverables";
import { formatReminder } from "@/lib/formatTime";
import { SourceMetaCard } from "./SourceMetaCard";
import { RelatedIdeas } from "./RelatedIdeas";

const NO_FOLDER = "__none__";

type Props = {
  ideaId: string | null;
  onClose: () => void;
  backLabel?: string;
  onSelectIdea?: (id: string) => void;
};

export const IdeaDetail = ({ ideaId, onClose, backLabel = "Back", onSelectIdea }: Props) => {
  const { data: idea, isLoading } = useIdea(ideaId);
  const { data: folders = [] } = useFolders();
  const updateIdea = useUpdateIdea();
  const deleteIdea = useDeleteIdea();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [rawNote, setRawNote] = useState("");
  const [summary, setSummary] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [tags, setTags] = useState("");
  const [folderId, setFolderId] = useState<string>(NO_FOLDER);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Swipe-right from the left edge to go back (mobile only, not while editing)
  useSwipeGesture(containerRef, {
    onSwipe: onClose,
    direction: "right",
    edgeSize: 24,
    enabled: isMobile && !editing && !!ideaId,
  });

  // Re-sync local edit state when the idea changes OR is updated server-side
  // (e.g. summarize re-runs from another flow). We skip the sync while the user
  // is mid-edit to avoid clobbering unsaved changes.
  useEffect(() => {
    if (idea && !editing) {
      setTitle(idea.title);
      setRawNote(idea.raw_note ?? "");
      setSummary(idea.ai_summary ?? "");
      setExtractedText(idea.extracted_text ?? "");
      setTags(idea.tags.join(", "));
      setFolderId(idea.folder_id ?? NO_FOLDER);
    }
  }, [idea?.id, idea?.updated_at, editing]);

  if (!ideaId) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select an idea to view it</p>
        </div>
      </div>
    );
  }

  if (isLoading || !idea) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm h-full">
        Loading…
      </div>
    );
  }

  const onSave = async () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    await updateIdea.mutateAsync({
      id: idea.id,
      patch: {
        title: title.trim(),
        raw_note: rawNote || null,
        ai_summary: summary || null,
        extracted_text: extractedText || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        folder_id: folderId === NO_FOLDER ? null : folderId,
      },
    });
    setEditing(false);
  };

  const onToggleFavorite = () => {
    updateIdea.mutate({ id: idea.id, patch: { is_favorite: !idea.is_favorite } });
  };

  const onTogglePin = () => {
    const next = idea.pinned_at ? null : new Date().toISOString();
    updateIdea.mutate(
      { id: idea.id, patch: { pinned_at: next } },
      {
        onSuccess: () => toast.success(next ? "Pinned to top" : "Unpinned"),
      },
    );
  };

  const confirmDelete = () => {
    deleteIdea.mutate(idea.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        onClose();
      },
    });
  };

  const onGeneratePrompt = async () => {
    if (generating) return;
    if (!idea.raw_note?.trim() && !idea.ai_summary?.trim() && !idea.extracted_text?.trim()) {
      toast.error("Add a note, summary, or extracted text first so the AI has something to work with.");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-prompt", {
        body: {
          title: idea.title,
          note: idea.raw_note,
          summary: idea.ai_summary,
          // Send the raw transcript/article too so the prompt can pull in
          // specific quotes/details that aren't in the distilled summary.
          extractedText: idea.extracted_text,
          sourceUrl: idea.source_url,
          sourceLabel: idea.source_label,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const prompt: string = data?.prompt ?? "";
      if (!prompt.trim()) throw new Error("Empty prompt returned");
      await updateIdea.mutateAsync({ id: idea.id, patch: { generated_prompt: prompt } });
      toast.success("Prompt ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate prompt");
    } finally {
      setGenerating(false);
    }
  };

  const onCopyPrompt = async () => {
    if (!idea.generated_prompt) return;
    try {
      await navigator.clipboard.writeText(idea.generated_prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — try selecting the text manually.");
    }
  };

  /**
   * Re-run the summarizer against the current source material and replace
   * `ai_summary` on the saved idea. Prefers `extracted_text` (URL/transcript
   * captures) and falls back to `raw_note` (manual notes/lists). Uses the
   * idea's `source_type` to pick the right summarizer prompt.
   */
  const onRegenerateSummary = async () => {
    if (regenerating) return;
    // When editing, use the in-progress edits so the user can tweak inputs
    // first, hit regenerate, and see the new summary land — without a save.
    const sourceText = (
      editing ? extractedText : (idea.extracted_text ?? "")
    ).trim() || (editing ? rawNote : (idea.raw_note ?? "")).trim();

    if (sourceText.length < 20) {
      toast.error("Add a note or extracted text first (at least a few sentences).");
      return;
    }

    const kind: "webpage" | "transcript" =
      idea.source_type === "webpage" ? "webpage" : "transcript";

    setRegenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize", {
        body: { text: sourceText, kind },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const next = (data?.summary ?? "").toString().trim();
      if (!next) throw new Error("Empty summary returned");

      await updateIdea.mutateAsync({
        id: idea.id,
        patch: { ai_summary: next },
      });
      // Reflect the new summary in the editor immediately if user is editing.
      setSummary(next);
      toast.success("Summary regenerated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to regenerate summary");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full overflow-hidden bg-background md:animate-none anim-slide-in">
      {/* iOS-style nav bar: text "Back" on left, action cluster on right */}
      <div className="safe-top sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-1 sm:px-4 py-1 sm:py-2 md:border-b border-border flex items-center gap-1 min-h-[44px]">
        <button
          onClick={onClose}
          className="press md:hidden flex items-center text-primary -ml-1 pl-1 pr-2 h-10 text-[17px] max-w-[55%]"
          aria-label={`Back to ${backLabel}`}
        >
          <ChevronLeft className="h-6 w-6 -mr-0.5 shrink-0" strokeWidth={2.4} />
          <span className="font-normal truncate">{backLabel}</span>
        </button>
        <div className="hidden md:flex items-center gap-2 min-w-0 flex-1 px-2">
          <Badge variant="secondary" className="capitalize">
            {idea.source_label || idea.source_type}
          </Badge>
        </div>
        <div className="flex-1 md:hidden" />
        <div className="flex items-center gap-0 sm:gap-1 shrink-0 pr-1">
          <button
            onClick={() => setReminderOpen(true)}
            className={`press h-10 w-10 flex items-center justify-center ${idea.remind_at ? "text-accent" : "text-primary"}`}
            aria-label="Reminder"
            title={idea.remind_at ? `Reminder ${formatReminder(idea.remind_at)}` : "Set reminder"}
          >
            <Bell className={`h-[20px] w-[20px] ${idea.remind_at ? "fill-accent/30" : ""}`} />
          </button>
          <button
            onClick={onTogglePin}
            className={`press h-10 w-10 flex items-center justify-center ${idea.pinned_at ? "text-accent" : "text-primary"}`}
            aria-label={idea.pinned_at ? "Unpin idea" : "Pin idea to top"}
            title={idea.pinned_at ? "Unpin from top" : "Pin to top"}
          >
            {idea.pinned_at ? (
              <PinOff className="h-[20px] w-[20px]" />
            ) : (
              <Pin className="h-[20px] w-[20px]" />
            )}
          </button>
          <button
            onClick={onToggleFavorite}
            className="press h-10 w-10 flex items-center justify-center text-primary"
            aria-label="Toggle favorite"
          >
            <Star
              className={`h-[22px] w-[22px] ${idea.is_favorite ? "fill-accent text-accent" : ""}`}
            />
          </button>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="press h-10 px-2 text-[17px] text-primary">
                Cancel
              </button>
              <button onClick={onSave} disabled={updateIdea.isPending} className="press h-10 px-2 text-[17px] text-primary font-semibold disabled:opacity-50">
                Save
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="press h-10 px-2 text-[17px] text-primary">
              Edit
            </button>
          )}
          <button
            onClick={() => setDeleteOpen(true)}
            className="press h-10 w-10 flex items-center justify-center text-destructive"
            aria-label="Delete"
          >
            <Trash2 className="h-[20px] w-[20px]" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum touch-pan-y px-4 sm:px-6 pt-4 sm:pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))] space-y-5">
        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-semibold h-auto py-2"
          />
        ) : (
          <h1 className="text-[28px] md:text-2xl font-bold md:font-semibold tracking-tight leading-tight">
            {idea.title}
          </h1>
        )}

        <SourceMetaCard idea={idea} />


        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground mr-1">Priority</span>
          <PrioritySelector
            value={idea.priority}
            onChange={(p) => updateIdea.mutate({ id: idea.id, patch: { priority: p } })}
            disabled={updateIdea.isPending}
          />
          {idea.remind_at && (
            <button
              onClick={() => setReminderOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent hover:bg-accent/15 press"
              title="Edit reminder"
            >
              <Bell className="h-3 w-3" />
              <span>{formatReminder(idea.remind_at)}</span>
              <span className="text-accent/70">·</span>
              <span className="text-accent/80">
                {[idea.notify_push && "push", idea.notify_email && "email"]
                  .filter(Boolean)
                  .join(" + ") || "muted"}
              </span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Created:</span>{" "}
            {new Date(idea.created_at).toLocaleString()}
          </div>
          <div>
            <span className="font-medium text-foreground">Updated:</span>{" "}
            {new Date(idea.updated_at).toLocaleString()}
          </div>
        </div>

        {editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Folder</label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All ideas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FOLDER}>All ideas</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Tags (comma separated)
              </label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}

        {!editing && idea.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {idea.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        )}

        {!editing && (idea.generated_prompt || idea.raw_note || idea.ai_summary) && (
          <section>
            <div className="flex items-center justify-between mb-2 gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Wand2 className="h-3.5 w-3.5 text-primary" /> Ready-to-paste prompt
              </h3>
              <div className="flex items-center gap-1.5">
                {idea.generated_prompt && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full text-xs"
                    onClick={onCopyPrompt}
                  >
                    {copied ? (
                      <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
                    )}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full text-xs"
                  onClick={onGeneratePrompt}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : idea.generated_prompt ? (
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5 mr-1" />
                  )}
                  {idea.generated_prompt ? "Regenerate" : "Generate prompt"}
                </Button>
              </div>
            </div>
            {idea.generated_prompt ? (
              <div className="rounded-xl bg-card border border-border p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed select-text">
                {idea.generated_prompt}
              </div>
            ) : (
              <div className="rounded-xl bg-muted/40 border border-dashed border-border p-4 text-xs text-muted-foreground">
                Combine your note with the AI summary into a single prompt you can paste into ChatGPT, Claude, or Gemini.
              </div>
            )}
          </section>
        )}

        {(editing || idea.ai_summary || idea.raw_note || idea.extracted_text) && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent" /> Summary
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRegenerateSummary}
                disabled={regenerating || updateIdea.isPending}
                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                title="Re-run AI summary from the current note or extracted text"
              >
                {regenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {idea.ai_summary ? "Regenerate" : "Generate"}
              </Button>
            </div>
            {editing ? (
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={8}
                className="font-mono text-sm"
                placeholder="No summary yet — click Generate to create one from your note or extracted text."
              />
            ) : idea.ai_summary ? (
              <div className="rounded-md bg-muted/40 p-4 text-sm prose prose-sm dark:prose-invert max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-foreground prose-a:text-primary prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{idea.ai_summary}</ReactMarkdown>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                No summary yet — click <span className="font-medium text-foreground">Generate</span> above to create one from your note or extracted text.
              </div>
            )}
          </section>
        )}

        {(() => {
          const isProject = idea.tags.includes(PROJECT_TAG);
          if (isProject && !editing) {
            return (
              <ProjectBoard
                rawNote={idea.raw_note}
                projectName={idea.title}
                onChange={(next) =>
                  updateIdea.mutate({ id: idea.id, patch: { raw_note: next } })
                }
              />
            );
          }
          if (!editing && !idea.raw_note) return null;
          const isChecklist = !!idea.raw_note && /^\s*- \[[ xX]\] /m.test(idea.raw_note);
          const toggleItem = (index: number) => {
            if (!idea.raw_note) return;
            let n = -1;
            const next = idea.raw_note
              .split("\n")
              .map((line) => {
                const m = line.match(/^(\s*- \[)([ xX])(\] )(.*)$/);
                if (!m) return line;
                n += 1;
                if (n !== index) return line;
                const toggled = m[2] === " " ? "x" : " ";
                return `${m[1]}${toggled}${m[3]}${m[4]}`;
              })
              .join("\n");
            updateIdea.mutate({ id: idea.id, patch: { raw_note: next } });
          };
          let checkboxIndex = -1;
          return (
            <section>
              <h3 className="text-sm font-semibold mb-2">
                {isProject ? "Deliverables (raw)" : isChecklist ? "Checklist" : "Note"}
              </h3>
              {editing ? (
                <Textarea
                  value={rawNote}
                  onChange={(e) => setRawNote(e.target.value)}
                  rows={isProject ? 12 : 6}
                  className={isProject ? "font-mono text-xs" : undefined}
                />
              ) : isChecklist ? (
                <div className="rounded-md bg-muted/40 p-4 text-sm prose prose-sm dark:prose-invert max-w-none prose-ul:my-0 prose-li:my-0.5">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      input: ({ checked, disabled, ...rest }) => {
                        if (rest.type !== "checkbox") return <input {...rest} />;
                        checkboxIndex += 1;
                        const idx = checkboxIndex;
                        return (
                          <input
                            type="checkbox"
                            checked={!!checked}
                            disabled={false}
                            onChange={() => toggleItem(idx)}
                            className="mr-2 h-4 w-4 cursor-pointer accent-primary align-middle"
                          />
                        );
                      },
                      li: ({ children, ...props }) => (
                        <li {...props} className="list-none -ml-6">{children}</li>
                      ),
                    }}
                  >
                    {idea.raw_note ?? ""}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm">{idea.raw_note}</p>
              )}
            </section>
          );
        })()}

        {(editing ? extractedText : idea.extracted_text) && (
          <section>
            <h3 className="text-sm font-semibold mb-2">Original extracted text</h3>
            {editing ? (
              <Textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                rows={8}
                className="text-xs leading-relaxed"
              />
            ) : (
              <div className="rounded-md border border-border bg-muted/20 p-4 text-xs whitespace-pre-wrap">
                {idea.extracted_text}
              </div>
            )}
          </section>
        )}
      </div>

      <IdeaReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        idea={
          idea
            ? {
                id: idea.id,
                title: idea.title,
                remind_at: idea.remind_at,
                notify_push: idea.notify_push,
                notify_email: idea.notify_email,
              }
            : null
        }
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this idea?</AlertDialogTitle>
            <AlertDialogDescription>
              "{idea.title}" will be permanently removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteIdea.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Prevent the default radix close so we control it after the
                // mutation succeeds (keeps the dialog open while deleting).
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleteIdea.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteIdea.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
