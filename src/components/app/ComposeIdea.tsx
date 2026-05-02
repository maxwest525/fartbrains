import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Inbox, Folder as FolderIcon, CheckCircle2, XCircle, ArrowRight, Pencil, ArrowLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDuplicateUrl } from "@/hooks/useDuplicateUrl";
import { useUrlCheck } from "@/hooks/useUrlCheck";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFolders, useCreateFolder } from "@/hooks/useFolders";
import { useCreateIdea } from "@/hooks/useIdeas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SourcePicker, isSourceEnabled, type SourceKey } from "./SourcePicker";

const NO_FOLDER = "__none__";
const NEW_FOLDER = "__new__";

type Props = {
  defaultFolderId?: string | null;
  onCreated?: (id: string) => void;
  onOpenExisting?: (id: string) => void;
};

const PLACEHOLDERS: Record<SourceKey, { url?: string; note: string }> = {
  instagram:  { url: "Instagram Reel URL", note: "Quick note (optional)" },
  link:       { url: "Paste a URL",        note: "Quick note (optional)" },
  note:       {                            note: "Write your idea…" },
  list:       {                            note: "One item per line…\nBuy milk\nCall dentist\nShip v2" },
  transcript: {                            note: "Paste a transcript, video caption, or any long text…" },
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

type PreviewState = {
  /** What we're previewing — drives whether source_type is webpage or transcript on save. */
  kind: "webpage" | "transcript";
  /** Text we extracted (URL) or pasted (transcript). Stored on save. */
  extractedText: string;
  /** Editable AI summary in markdown. */
  summary: string;
  /** Editable title. */
  title: string;
  /** For webpage: the original URL. */
  sourceUrl: string | null;
};

/**
 * Always-visible compose card. Lives on the main page above the idea list
 * so capture is one tap away — no modal required.
 *
 * Web URL and Transcript flows show an editable AI-summary preview before saving.
 */
export const ComposeIdea = ({ defaultFolderId, onCreated, onOpenExisting }: Props) => {
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();
  const createFolder = useCreateFolder();

  const [source, setSource] = useState<SourceKey>("instagram");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<string>(defaultFolderId ?? NO_FOLDER);
  const [saving, setSaving] = useState(false);

  // AI preview workflow state.
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  // Inline new-folder UI (triggered from dropdown item or chip).
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Quick-capture: refs let us auto-focus the primary input on mount + on source change
  // so the user can land on the page and immediately paste/type without an extra tap.
  const urlInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep folder selection in sync when the parent switches active folder filter.
  useEffect(() => {
    setFolder(defaultFolderId ?? NO_FOLDER);
  }, [defaultFolderId]);

  // Auto-focus the primary capture field whenever the active source changes
  // (and on first mount). Skip when the AI preview is on screen — that view
  // owns its own focus.
  useEffect(() => {
    if (preview) return;
    // Defer to next frame so the field is mounted/visible.
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
  }, [source, preview]);

  const { data: urlDuplicate } = useDuplicateUrl(
    source === "instagram" || source === "link" ? url : ""
  );

  // Live reachability check on the URL field — debounced server call.
  const urlCheck = useUrlCheck(url, source === "instagram" || source === "link");

  const reset = () => {
    setUrl("");
    setNote("");
    setTitle("");
    setPreview(null);
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
    setPreview(null);
  };

  /**
   * Instant capture: extract + summarize + save in one shot.
   * No intermediate preview — user edits in detail view if needed.
   */
  const handleGenerateAndSave = async () => {
    if (generating || saving) return;

    if (needsUrl) {
      if (!url.trim()) return toast.error("URL required");
    } else if (isTranscript) {
      if (note.trim().length < 20) return toast.error("Paste at least a few sentences");
    }

    setGenerating(true);
    try {
      let extractedText = "";
      let suggestedTitleFromExtract: string | undefined;
      const sourceUrl = needsUrl ? url.trim() : null;

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
        extractedText = note.trim();
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

      onCreated?.(idea.id);
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

  /** Final save — for note/list (instant) and for previewed webpage/transcript ideas. */
  const handleSave = async () => {
    if (saving) return;

    // Preview-confirm save path (webpage / transcript)
    if (preview) {
      setSaving(true);
      try {
        const idea = await createIdea.mutateAsync({
          title: (preview.title.trim() || "Untitled idea").slice(0, 200),
          raw_note: null,
          source_url: preview.sourceUrl,
          source_type: preview.kind, // "webpage" | "transcript"
          extracted_text: preview.extractedText || null,
          ai_summary: preview.summary.trim() || null,
          folder_id: folderOrNull(folder),
          tags: [],
        });
        onCreated?.(idea.id);
        reset();
      } finally {
        setSaving(false);
      }
      return;
    }

    // Direct save path (manual note or list)
    if (source === "note" && !note.trim() && !title.trim())
      return toast.error("Add a title or a note");
    if (source === "list" && !note.trim() && !title.trim())
      return toast.error("Add at least one list item or a title");

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

  const ph = PLACEHOLDERS[source];

  // ── Preview / Edit AI Summary view ───────────────────────────────────────────
  if (preview) {
    return (
      <div className="rounded-2xl bg-card border border-border/60 p-3 sm:p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" />
            Review & edit
          </div>
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Title</label>
          <Input
            value={preview.title}
            onChange={(e) => setPreview({ ...preview, title: e.target.value })}
            placeholder="Title"
            className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
            maxLength={200}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            AI summary <span className="text-muted-foreground/70">(editable, markdown)</span>
          </label>
          <Textarea
            value={preview.summary}
            onChange={(e) => setPreview({ ...preview, summary: e.target.value })}
            placeholder="No summary generated — write your own or save without one."
            rows={10}
            className="rounded-xl bg-secondary/60 border-transparent text-[14px] leading-relaxed font-mono resize-none"
          />
        </div>

        {preview.sourceUrl && (
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground truncate">
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="truncate">{preview.sourceUrl}</span>
          </div>
        )}

        <Select value={folder} onValueChange={setFolder}>
          <SelectTrigger className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_FOLDER}>All ideas</SelectItem>
            {folders.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleSave}
          disabled={saving || createIdea.isPending}
          className="w-full h-12 rounded-xl text-[16px] font-semibold"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Save idea
            </>
          )}
        </Button>
      </div>
    );
  }

  // ── Default capture view ─────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl bg-card border border-border/60 p-3 sm:p-4 space-y-3 shadow-sm">
      <SourcePicker value={source} onChange={handleSourceChange} />

      {needsUrl && (
        <Input
          ref={urlInputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={ph.url}
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus
          className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
        />
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
        <Textarea
          ref={noteTextareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={ph.note}
          rows={isTranscript ? 8 : source === "list" ? 5 : 4}
          className="rounded-xl bg-secondary/60 border-transparent text-[15px] resize-none"
        />
      ) : (
        <Input
          ref={noteInputRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={ph.note}
          className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
        />
      )}

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional — AI will fill in)"
        className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
      />

      <Select
        value={folder}
        onValueChange={(v) => {
          if (v === NEW_FOLDER) {
            setNewFolderOpen(true);
            return;
          }
          setFolder(v);
        }}
      >
        <SelectTrigger className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NEW_FOLDER}>
            <span className="flex items-center gap-2 text-primary font-medium">
              <Plus className="h-4 w-4" />
              New folder…
            </span>
          </SelectItem>
          <SelectSeparator />
          <SelectItem value={NO_FOLDER}>All ideas</SelectItem>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

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
        onClick={usesAiPreview ? handleGenerateAndSave : handleSave}
        disabled={saving || generating || createIdea.isPending}
        className="w-full h-12 rounded-xl text-[16px] font-semibold"
      >
        {saving || generating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-1.5" />
            {needsUrl
              ? "Extract & preview"
              : isTranscript
                ? "Summarize & preview"
                : source === "list"
                  ? "Save list"
                  : "Save idea"}
          </>
        )}
      </Button>

      {usesAiPreview && (
        <p className="text-xs text-muted-foreground text-center">
          We'll generate a summary you can edit before saving.
        </p>
      )}
    </div>
  );
};
