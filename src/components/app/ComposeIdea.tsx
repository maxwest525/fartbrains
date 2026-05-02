import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Inbox, Folder as FolderIcon, CheckCircle2, XCircle, ArrowRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDuplicateUrl } from "@/hooks/useDuplicateUrl";
import { useUrlCheck } from "@/hooks/useUrlCheck";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useFolders, useCreateFolder } from "@/hooks/useFolders";
import { useCreateIdea } from "@/hooks/useIdeas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SourcePicker, isSourceEnabled, type SourceKey } from "./SourcePicker";
import { ProjectComposer } from "./ProjectComposer";
import { PROJECT_TAG } from "@/lib/deliverables";

const NO_FOLDER = "__none__";


type Props = {
  defaultFolderId?: string | null;
  /** Called after a successful save. `needsReview` is true when AI confidence
   *  is low (short/empty summary, no suggested title, or thin extracted text)
   *  so the parent can open the detail panel for one-tap edit. */
  onCreated?: (id: string, needsReview?: boolean) => void;
  onOpenExisting?: (id: string) => void;
};

const PLACEHOLDERS: Record<SourceKey, { url?: string; note: string }> = {
  instagram:  { url: "Instagram Reel URL", note: "Quick note (optional)" },
  link:       { url: "Paste a URL",        note: "Quick note (optional)" },
  note:       {                            note: "Write your idea…" },
  list:       {                            note: "One item per line…\nBuy milk\nCall dentist\nShip v2" },
  transcript: {                            note: "Paste a transcript, video caption, or any long text…" },
  project:    {                            note: "" },
  voice:      { note: "" },
  image:      { note: "" },
  prompt:     { note: "" },
};

/** Convert raw textarea lines into a markdown checklist. Blank lines are skipped. */
const linesToChecklist = (raw: string): string =>
  raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/^- \[[ xX]\] /.test(l) ? l : `- [ ] ${l}`))
    .join("\n");


/**
 * Always-visible compose card. Lives on the main page above the idea list
 * so capture is one tap away — no modal required.
 *
 * URL and transcript captures extract + summarize + save in a single tap.
 * The optional title is auto-filled by AI; users edit on the idea detail view.
 */
export const ComposeIdea = ({ defaultFolderId, onCreated, onOpenExisting }: Props) => {
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();
  const createFolder = useCreateFolder();

  const [source, setSource] = useState<SourceKey>("note");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<string>(defaultFolderId ?? NO_FOLDER);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Inline new-folder UI (triggered from chip).
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Quick-capture: refs let us auto-focus the primary input on mount + on source change.
  const urlInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep folder selection in sync when the parent switches active folder filter.
  useEffect(() => {
    setFolder(defaultFolderId ?? NO_FOLDER);
  }, [defaultFolderId]);

  // Auto-focus the primary capture field whenever the active source changes.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (source === "instagram" || source === "link") {
        urlInputRef.current?.focus();
      } else if (source === "note" || source === "list" || source === "transcript") {
        noteTextareaRef.current?.focus();
      } else {
        noteInputRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [source]);

  const { data: urlDuplicate } = useDuplicateUrl(
    source === "instagram" || source === "link" ? url : ""
  );

  const urlCheck = useUrlCheck(url, source === "instagram" || source === "link");

  const reset = () => {
    setUrl("");
    setNote("");
    setTitle("");
  };

  const folderOrNull = (v: string) => (v === NO_FOLDER ? null : v);
  const needsUrl = source === "instagram" || source === "link";
  const isTranscript = source === "transcript";
  const usesAiPreview = needsUrl || isTranscript;

  const handleSourceChange = (key: SourceKey) => {
    if (!isSourceEnabled(key)) {
      toast("Coming soon", {
        description: `${key.charAt(0).toUpperCase() + key.slice(1)} captures are on the roadmap.`,
      });
      return;
    }
    setSource(key);
  };

  /**
   * Instant capture: extract + summarize + save in one shot.
   * No intermediate preview — user edits in detail view if needed.
   *
   * `urlOverride` lets paste handlers pass the freshly-pasted URL synchronously,
   * before React state has had a chance to update.
   */
  const handleGenerateAndSave = async (
    overrides?: { url?: string; note?: string }
  ) => {
    if (generating || saving) return;

    const effectiveUrl = (overrides?.url ?? url).trim();
    const effectiveNote = (overrides?.note ?? note).trim();

    if (needsUrl) {
      if (!effectiveUrl) return toast.error("URL required");
    } else if (isTranscript) {
      if (effectiveNote.length < 20) return toast.error("Paste at least a few sentences");
    }

    setGenerating(true);
    try {
      let extractedText = "";
      let suggestedTitleFromExtract: string | undefined;
      const sourceUrl = needsUrl ? effectiveUrl : null;

      if (needsUrl) {
        const fnName = source === "instagram" ? "extract-instagram" : "extract-url";
        const { data: ext, error: extErr } = await supabase.functions.invoke(fnName, {
          body: { url: sourceUrl },
        });
        if (extErr) throw new Error(extErr.message);
        if (ext?.error) throw new Error(ext.error);
        extractedText = ext?.text ?? "";
        suggestedTitleFromExtract = ext?.title ?? undefined;
      } else {
        extractedText = effectiveNote;
      }

      let summary = "";
      let aiTitle: string | undefined;
      try {
        const { data: sum, error: sumErr } = await supabase.functions.invoke("summarize", {
          body: {
            text: extractedText,
            kind: needsUrl ? "webpage" : "transcript",
          },
        });
        if (sumErr) throw new Error(sumErr.message);
        if (sum?.error) throw new Error(sum.error);
        summary = sum?.summary ?? "";
        aiTitle = sum?.suggestedTitle ?? undefined;
      } catch (e) {
        // Non-fatal: still save with extracted text.
        toast.warning(e instanceof Error ? `AI summary failed: ${e.message}` : "AI summary failed");
      }

      const finalTitle = (
        title.trim() ||
        aiTitle ||
        suggestedTitleFromExtract ||
        (sourceUrl ?? extractedText.split("\n")[0] ?? "").slice(0, 80) ||
        "Untitled idea"
      ).slice(0, 200);

      const idea = await createIdea.mutateAsync({
        title: finalTitle,
        raw_note: null,
        source_url: sourceUrl,
        source_type: needsUrl ? "webpage" : "transcript",
        extracted_text: extractedText || null,
        ai_summary: summary.trim() || null,
        folder_id: folderOrNull(folder),
        tags: [],
      });

      // Heuristic confidence check — when low, send the user straight to edit.
      const summaryClean = summary.trim();
      const hasMainIdea = /\*\*Main idea:\*\*/i.test(summaryClean);
      const hasKeyPoints = /\*\*Key points:\*\*/i.test(summaryClean);
      const needsReview =
        !summaryClean ||
        summaryClean.length < 150 ||
        !hasMainIdea ||
        !hasKeyPoints ||
        !aiTitle ||
        extractedText.trim().length < 200;

      if (needsReview) {
        toast.message("Saved — needs a quick review", {
          description: "AI wasn't fully confident, so we opened the idea for you to edit.",
        });
      }

      onCreated?.(idea.id, needsReview);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save idea");
    } finally {
      setGenerating(false);
    }
  };

  /** Create a folder inline and immediately select it. */
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

  /** Direct save for manual note or list captures. */
  const handleSave = async () => {
    if (saving) return;

    if (source === "note" && !note.trim() && !title.trim())
      return toast.error("Add a note");
    if (source === "list" && !note.trim() && !title.trim())
      return toast.error("Add at least one list item");

    setSaving(true);
    try {
      const userTitle = title.trim();
      const isList = source === "list";
      const listBody = isList ? linesToChecklist(note) : null;

      const fallbackTitle =
        userTitle ||
        (isList
          ? (note.trim().split("\n").find((l) => l.trim()) ?? "").slice(0, 80) || "Checklist"
          : note.trim().split("\n")[0].slice(0, 80)) ||
        "Untitled idea";

      const idea = await createIdea.mutateAsync({
        title: fallbackTitle,
        raw_note: isList ? listBody : (note.trim() || null),
        source_url: null,
        source_type: "manual",
        folder_id: folderOrNull(folder),
        tags: isList ? ["list"] : [],
      });

      onCreated?.(idea.id);
      reset();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateProject = async ({ name, rawNote }: { name: string; rawNote: string }) => {
    if (saving) return;
    setSaving(true);
    try {
      const idea = await createIdea.mutateAsync({
        title: name.slice(0, 200),
        raw_note: rawNote,
        source_url: null,
        source_type: "manual",
        folder_id: folderOrNull(folder),
        tags: [PROJECT_TAG],
      });
      onCreated?.(idea.id);
      reset();
      // Switch back to default capture so the user sees their next blank slate.
      setSource("note");
    } finally {
      setSaving(false);
    }
  };

  const ph = PLACEHOLDERS[source];

  // (Preview/edit step removed — saves go through directly. Edit on the idea detail view.)

  // Folder chips block, reused for both default capture and project mode.
  const folderChips = (
    <>
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
    </>
  );

  // ── Default capture view ─────────────────────────────────────────────────────
  if (source === "project") {
    return (
      <div className="rounded-2xl bg-card border border-border/60 p-3 sm:p-4 space-y-3 shadow-sm">
        <SourcePicker value={source} onChange={handleSourceChange} />
        <ProjectComposer saving={saving || createIdea.isPending} onCreate={handleCreateProject} />
        {folderChips}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-3 sm:p-4 space-y-3 shadow-sm">
      <SourcePicker value={source} onChange={handleSourceChange} />

      {needsUrl && (
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            {source === "instagram" ? "Instagram URL" : "Website URL"}
          </label>
          <Input
            ref={urlInputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              // Auto-trigger save the moment a valid URL is pasted into an empty field.
              // Only fires when the input is empty (otherwise it's an edit, not a fresh capture)
              // and only if the pasted text parses as a real URL.
              const pasted = e.clipboardData.getData("text").trim();
              if (!pasted || url.trim().length > 0) return;
              try {
                const u = new URL(pasted);
                if (u.protocol !== "http:" && u.protocol !== "https:") return;
              } catch {
                return;
              }
              setUrl(pasted);
              // Defer so the input visibly updates before the network call starts.
              setTimeout(() => handleGenerateAndSave({ url: pasted }), 0);
            }}
            placeholder={ph.url}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus
            className="h-16 rounded-2xl bg-secondary/60 border-transparent text-[18px] font-medium px-4 placeholder:font-normal placeholder:text-muted-foreground/70"
          />
        </div>
      )}

      {/* Live URL reachability — only shown when the user has typed something */}
      {needsUrl && url.trim() && urlCheck.status !== "idle" && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
            urlCheck.status === "checking" && "bg-secondary/60 text-muted-foreground",
            urlCheck.status === "ok" && "bg-[hsl(140_70%_45%/0.1)] text-[hsl(140_70%_30%)] dark:text-[hsl(140_60%_60%)]",
            urlCheck.status === "error" && "bg-destructive/10 text-destructive"
          )}
          role="status"
          aria-live="polite"
        >
          {urlCheck.status === "checking" && (
            <Loader2 className="h-3.5 w-3.5 mt-0.5 shrink-0 animate-spin" />
          )}
          {urlCheck.status === "ok" && (
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          )}
          {urlCheck.status === "error" && (
            <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium leading-tight">{urlCheck.message}</div>
            {urlCheck.status === "ok" && urlCheck.redirected && urlCheck.finalUrl && (
              <div className="mt-0.5 flex items-center gap-1 text-[11.5px] opacity-80 truncate">
                <ArrowRight className="h-3 w-3 shrink-0" />
                <span className="truncate">{urlCheck.finalUrl}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {urlDuplicate && needsUrl && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground">You already saved this link</div>
            <div className="text-muted-foreground truncate">"{urlDuplicate.title}"</div>
          </div>
          {onOpenExisting && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenExisting(urlDuplicate.id);
                reset();
              }}
            >
              Open
            </Button>
          )}
        </div>
      )}

      {source === "note" || source === "list" || isTranscript ? (
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            {isTranscript ? "Transcript or long text" : source === "list" ? "Checklist items" : "Your idea"}
          </label>
          <Textarea
            ref={noteTextareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onPaste={(e) => {
              // Auto-trigger summarize+save when a substantial transcript is pasted into an empty field.
              if (!isTranscript) return;
              const pasted = e.clipboardData.getData("text").trim();
              if (pasted.length < 20 || note.trim().length > 0) return;
              setNote(pasted);
              setTimeout(() => handleGenerateAndSave({ note: pasted }), 0);
            }}
            placeholder={ph.note}
            rows={isTranscript ? 8 : source === "list" ? 5 : 4}
            className="rounded-2xl bg-secondary/60 border-transparent text-[18px] font-medium px-4 py-3 leading-snug resize-none placeholder:font-normal placeholder:text-muted-foreground/70"
          />
        </div>
      ) : (
        <Input
          ref={noteInputRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={ph.note}
          className="h-16 rounded-2xl bg-secondary/60 border-transparent text-[18px] font-medium px-4 placeholder:font-normal placeholder:text-muted-foreground/70"
        />
      )}

      {/* Inline new-folder name field — opens from dropdown item or chip. */}
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

      {/* Quick folder chips — tap to set folder above without opening the dropdown. */}
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
        {/* New folder chip — always available */}
        <button
          type="button"
          onClick={() => setNewFolderOpen(true)}
          className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium border border-dashed border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors press"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      <Button
        onClick={usesAiPreview ? () => handleGenerateAndSave() : handleSave}
        disabled={saving || generating || createIdea.isPending}
        className="w-full h-12 rounded-xl text-[16px] font-semibold"
      >
        {saving || generating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-1.5" />
            {needsUrl
              ? "Save & summarize"
              : isTranscript
                ? "Save & summarize"
                : source === "list"
                  ? "Save list"
                  : "Save idea"}
          </>
        )}
      </Button>
    </div>
  );
};
