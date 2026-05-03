import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Inbox, Folder as FolderIcon, CheckCircle2, XCircle, ArrowRight, Plus, FileText, X, Wand2, Copy } from "lucide-react";
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
import { TranscriptCaptureScreen } from "./TranscriptCaptureScreen";
import { PROJECT_TAG } from "@/lib/deliverables";
import { validateOptimizedPrompt, type ValidationResult } from "@/lib/promptValidation";

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
  instagram:  { url: "Paste a URL (Instagram, article, video…)", note: "Quick note (optional)" },
  link:       { url: "Paste a URL (Instagram, article, video…)", note: "Quick note (optional)" },
  note:       {                            note: "Write your idea…" },
  list:       {                            note: "One item per line…\nBuy milk\nCall dentist\nShip v2" },
  transcript: {                            note: "Paste a transcript, video caption, or any long text…" },
  project:    {                            note: "" },
  voice:      { note: "" },
  image:      { note: "" },
  prompt:     { note: "Paste a draft prompt to optimize…" },
};

/**
 * Auto-detect the source platform from a pasted URL so the compose flow can
 * route to the right extractor and show the user what we'll do with it.
 *
 *  - instagram → transcribe-instagram (audio + caption via Apify + ElevenLabs)
 *  - tiktok    → extract-url (best-effort meta + page text; no audio yet)
 *  - youtube   → extract-url (best-effort title + description scrape)
 *  - webpage   → extract-url (generic article reader)
 */
type UrlPlatform = "instagram" | "tiktok" | "youtube" | "webpage" | "invalid";

const detectUrlPlatform = (raw: string): { kind: UrlPlatform; label: string; hint: string } => {
  const trimmed = raw.trim();
  if (!trimmed) return { kind: "invalid", label: "URL", hint: "" };
  let u: URL;
  try {
    u = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { kind: "invalid", label: "Invalid URL", hint: "Paste a full http(s) link" };
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (/(^|\.)instagram\.com$/.test(host)) {
    return { kind: "instagram", label: "Instagram", hint: "Will transcribe audio + pull caption" };
  }
  if (/(^|\.)tiktok\.com$/.test(host) || host === "vm.tiktok.com") {
    return { kind: "tiktok", label: "TikTok", hint: "Will pull title & description (no audio yet)" };
  }
  if (/(^|\.)youtube\.com$/.test(host) || host === "youtu.be") {
    return { kind: "youtube", label: "YouTube", hint: "Will pull title & description (no audio yet)" };
  }
  return { kind: "webpage", label: "Web page", hint: "Will extract readable article text" };
};

const isInstagramUrl = (raw: string): boolean =>
  detectUrlPlatform(raw).kind === "instagram";

/** Target LLMs offered in the Prompt optimizer. */
const PROMPT_TARGETS = [
  { value: "GPT-5",                  label: "ChatGPT (GPT-5 / 5.2)" },
  { value: "Claude Sonnet / Opus",   label: "Claude (Sonnet / Opus)" },
  { value: "Gemini 2.5 / 3 Pro",     label: "Gemini (2.5 / 3 Pro)" },
  { value: "Grok",                   label: "Grok" },
  { value: "Llama 3.x",              label: "Llama 3.x" },
  { value: "Generic / any LLM",      label: "Generic / any LLM" },
] as const;

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

  // URL preview step: after extraction, hold the readable text + suggested title
  // so the user can review (and tweak the title) before committing to save.
  const [preview, setPreview] = useState<{
    url: string;
    text: string;
    suggestedTitle?: string;
    sourceKind: "webpage" | "instagram";
  } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // When the URL preview card appears, scroll it into view so the Save button
  // isn't hidden behind the mobile bottom tab bar.
  useEffect(() => {
    if (preview && previewRef.current) {
      // Wait one frame so layout settles before scrolling.
      requestAnimationFrame(() => {
        previewRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview?.url]);

  // Prompt optimizer state.
  const [promptTarget, setPromptTarget] = useState<string>(PROMPT_TARGETS[0].value);
  const [optimizedPrompt, setOptimizedPrompt] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [promptValidation, setPromptValidation] = useState<ValidationResult | null>(null);
  const [overrideWarnings, setOverrideWarnings] = useState(false);
  const [draftAtOptimize, setDraftAtOptimize] = useState<string>("");

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
      } else if (source === "note" || source === "list" || source === "transcript" || source === "prompt") {
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
    setPreview(null);
    setOptimizedPrompt(null);
    setPromptValidation(null);
    setOverrideWarnings(false);
    setDraftAtOptimize("");
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
   * Step 1 (URL only): extract readable text and show a preview card.
   * The user reviews the extracted content before committing to save.
   *
   * `urlOverride` lets paste handlers pass the freshly-pasted URL synchronously.
   */
  const handleExtract = async (overrides?: { url?: string }) => {
    if (extracting || generating || saving) return;
    const effectiveUrl = (overrides?.url ?? url).trim();
    if (!effectiveUrl) return toast.error("URL required");

    setExtracting(true);
    try {
      // Auto-detect: Instagram URLs go to the transcribe pipeline; everything
      // else uses the generic readable-text extractor.
      const isInsta = isInstagramUrl(effectiveUrl);
      const fnName = isInsta ? "transcribe-instagram" : "extract-url";
      const { data: ext, error: extErr } = await supabase.functions.invoke(fnName, {
        body: { url: effectiveUrl },
      });
      if (extErr) throw new Error(extErr.message);
      if (ext?.error) throw new Error(ext.error);

      // transcribe-instagram returns { transcript, caption, ... }; extract-url returns { text }.
      let text = "";
      let suggestedTitle: string | undefined;
      if (isInsta) {
        const transcript = (ext?.transcript ?? "").trim();
        const caption = (ext?.caption ?? "").trim();
        text = transcript && caption
          ? `${transcript}\n\n— Caption —\n${caption}`
          : (transcript || caption);
        suggestedTitle = ext?.title ?? undefined;
      } else {
        text = (ext?.text ?? "").trim();
        suggestedTitle = ext?.title ?? undefined;
      }
      if (!text) throw new Error("Couldn't extract any readable text from this page");

      setPreview({
        url: ext?.finalUrl ?? effectiveUrl,
        text,
        suggestedTitle,
        sourceKind: isInsta ? "instagram" : "webpage",
      });
      // Pre-fill the title field with the extracted title (only if user hasn't typed one).
      if (!title.trim() && suggestedTitle) setTitle(String(suggestedTitle).slice(0, 200));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't extract content");
    } finally {
      setExtracting(false);
    }
  };

  /**
   * Transcript flow stays a single tap: extract+summarize+save.
   * URL flow is now two-step (extract → preview → save).
   */
  const handleGenerateAndSave = async (
    overrides?: { url?: string; note?: string }
  ) => {
    if (generating || saving) return;

    // Route URL captures through the new preview step.
    if (needsUrl) return handleExtract({ url: overrides?.url });

    const effectiveNote = (overrides?.note ?? note).trim();
    if (isTranscript && effectiveNote.length < 20) {
      return toast.error("Paste at least a few sentences");
    }

    setGenerating(true);
    try {
      const extractedText = effectiveNote;
      let summary = "";
      let aiTitle: string | undefined;
      try {
        const { data: sum, error: sumErr } = await supabase.functions.invoke("summarize", {
          body: { text: extractedText, kind: "transcript" },
        });
        if (sumErr) throw new Error(sumErr.message);
        if (sum?.error) throw new Error(sum.error);
        summary = sum?.summary ?? "";
        aiTitle = sum?.suggestedTitle ?? undefined;
      } catch (e) {
        toast.warning(e instanceof Error ? `AI summary failed: ${e.message}` : "AI summary failed");
      }

      const finalTitle = (
        title.trim() || aiTitle || extractedText.split("\n")[0]?.slice(0, 80) || "Untitled idea"
      ).slice(0, 200);

      const idea = await createIdea.mutateAsync({
        title: finalTitle,
        raw_note: null,
        source_url: null,
        source_type: "transcript",
        extracted_text: extractedText || null,
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
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save idea");
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Step 2 (URL only): commit the previewed extraction. Summarize + save.
   * `editedText` lets the user trim or tweak the extracted text before saving.
   */
  const handleSavePreview = async () => {
    if (!preview || generating || saving) return;
    setGenerating(true);
    try {
      let summary = "";
      let aiTitle: string | undefined;
      try {
        const { data: sum, error: sumErr } = await supabase.functions.invoke("summarize", {
          body: { text: preview.text, kind: "webpage" },
        });
        if (sumErr) throw new Error(sumErr.message);
        if (sum?.error) throw new Error(sum.error);
        summary = sum?.summary ?? "";
        aiTitle = sum?.suggestedTitle ?? undefined;
      } catch (e) {
        toast.warning(e instanceof Error ? `AI summary failed: ${e.message}` : "AI summary failed");
      }

      const finalTitle = (
        title.trim() || aiTitle || preview.suggestedTitle || preview.url
      ).slice(0, 200);

      const idea = await createIdea.mutateAsync({
        title: finalTitle,
        raw_note: null,
        source_url: preview.url,
        source_type: "webpage",
        extracted_text: preview.text || null,
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
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save idea");
    } finally {
      setGenerating(false);
    }
  };

  /** Prompt optimizer: rewrite the user's draft for the chosen target LLM. */
  const handleOptimizePrompt = async () => {
    if (optimizing || saving) return;
    const draft = note.trim();
    if (draft.length < 10) {
      return toast.error("Paste a draft prompt first (min 10 characters).");
    }
    setOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("optimize-prompt", {
        body: { draft, targetModel: promptTarget },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const optimized = (data?.optimized ?? "").trim();
      if (!optimized) throw new Error("AI returned an empty prompt. Try again.");
      const result = validateOptimizedPrompt(optimized, draft);
      setDraftAtOptimize(draft);
      setOptimizedPrompt(optimized);
      setPromptValidation(result);
      setOverrideWarnings(false);
      if (!result.ok) {
        toast.error("Optimized prompt failed safety checks — see details below.");
      } else if (result.warnings.length > 0) {
        toast.warning("Optimized prompt has warnings — review before saving.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't optimize prompt");
    } finally {
      setOptimizing(false);
    }
  };

  /** Save the optimized prompt as an idea (tagged "prompt"). */
  const handleSaveOptimizedPrompt = async () => {
    if (!optimizedPrompt || saving) return;
    // Re-validate at save time in case the user edited the textarea after optimize.
    const result = validateOptimizedPrompt(optimizedPrompt, draftAtOptimize || note.trim());
    setPromptValidation(result);
    if (!result.ok) {
      toast.error("Can't save — fix the issues flagged below or re-optimize.");
      return;
    }
    if (result.warnings.length > 0 && !overrideWarnings) {
      toast.warning("Tap 'Save anyway' to confirm despite warnings.");
      return;
    }
    setSaving(true);
    try {
      const finalTitle = (
        title.trim() ||
        `Prompt for ${promptTarget}` ||
        "Prompt"
      ).slice(0, 200);

      const idea = await createIdea.mutateAsync({
        title: finalTitle,
        raw_note: note.trim() || null,
        source_url: null,
        source_type: "manual",
        extracted_text: optimizedPrompt,
        ai_summary: `Optimized for ${promptTarget}.`,
        folder_id: folderOrNull(folder),
        tags: ["prompt"],
      });
      onCreated?.(idea.id);
      reset();
      setSource("note");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save prompt");
    } finally {
      setSaving(false);
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
  if (source === "transcript") {
    return (
      <>
        <div className="rounded-2xl bg-card border border-border/60 p-3 sm:p-4 space-y-3 shadow-sm">
          <SourcePicker value={source} onChange={handleSourceChange} />
          {folderChips}
        </div>
        <TranscriptCaptureScreen
          defaultFolderId={folderOrNull(folder)}
          onBack={() => setSource("note")}
          onCreated={(id, needsReview) => {
            onCreated?.(id, needsReview);
            reset();
          }}
        />
      </>
    );
  }

  if (source === "project") {
    return (
      <div className="rounded-2xl bg-card border border-border/60 p-3 sm:p-4 space-y-3 shadow-sm">
        <SourcePicker value={source} onChange={handleSourceChange} />
        <ProjectComposer saving={saving || createIdea.isPending} onCreate={handleCreateProject} />
        {folderChips}
      </div>
    );
  }

  if (source === "prompt") {
    return (
      <div className="rounded-2xl bg-card border border-border/60 p-3 sm:p-4 space-y-3 shadow-sm">
        <SourcePicker value={source} onChange={handleSourceChange} />

        <div className="rounded-xl bg-secondary/40 border border-border/50 px-3 py-2.5 flex items-start gap-2.5">
          <Wand2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 text-[12.5px] leading-snug text-muted-foreground">
            Paste a draft prompt and we'll restructure it (role, task, context,
            constraints, output format) optimized for the LLM you're targeting.
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            Target LLM
          </label>
          <select
            value={promptTarget}
            onChange={(e) => setPromptTarget(e.target.value)}
            className="w-full h-11 rounded-xl bg-secondary/60 border border-transparent px-3 text-[15px] font-medium focus:outline-none focus:border-primary/40"
          >
            {PROMPT_TARGETS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            Your draft prompt
          </label>
          <Textarea
            ref={noteTextareaRef}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (optimizedPrompt) setOptimizedPrompt(null);
            }}
            placeholder={ph.note}
            rows={6}
            className="rounded-2xl bg-secondary/60 border-transparent text-[16px] px-4 py-3 leading-snug resize-none placeholder:text-muted-foreground/70"
          />
          <div className="text-[11.5px] text-muted-foreground px-1 flex justify-between">
            <span>{note.trim().length.toLocaleString()} chars</span>
            <span className="opacity-70">Min 10 · max 8,000</span>
          </div>
        </div>

        {optimizedPrompt && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 sm:p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="h-9 w-9 rounded-[10px] bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Optimized for {promptTarget}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  Edit anything below before saving.
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(optimizedPrompt);
                    toast.success("Copied to clipboard");
                  } catch {
                    toast.error("Couldn't copy");
                  }
                }}
                className="press text-muted-foreground hover:text-foreground p-1.5 -mr-1 -mt-1 rounded-md"
                aria-label="Copy optimized prompt"
                title="Copy"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>

            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Title (default: "Prompt for ${promptTarget}")`}
              maxLength={200}
              className="h-10 rounded-xl bg-card border-border/60 text-[14px]"
            />

            <Textarea
              value={optimizedPrompt}
              onChange={(e) => {
                setOptimizedPrompt(e.target.value);
                const r = validateOptimizedPrompt(e.target.value, draftAtOptimize || note.trim());
                setPromptValidation(r);
                setOverrideWarnings(false);
              }}
              rows={10}
              className="rounded-xl bg-card border-border/60 text-[13.5px] leading-relaxed font-mono resize-y max-h-[50vh]"
            />

            {promptValidation && (promptValidation.errors.length > 0 || promptValidation.warnings.length > 0) && (
              <div
                className={cn(
                  "rounded-xl border p-3 space-y-2 text-[12.5px]",
                  promptValidation.errors.length > 0
                    ? "border-destructive/40 bg-destructive/10"
                    : "border-amber-500/40 bg-amber-500/10",
                )}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className={cn(
                    "h-3.5 w-3.5",
                    promptValidation.errors.length > 0 ? "text-destructive" : "text-amber-600",
                  )} />
                  <span>
                    {promptValidation.errors.length > 0
                      ? `${promptValidation.errors.length} issue${promptValidation.errors.length === 1 ? "" : "s"} blocking save`
                      : `${promptValidation.warnings.length} warning${promptValidation.warnings.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                <ul className="space-y-1 pl-1">
                  {[...promptValidation.errors, ...promptValidation.warnings].map((r) => (
                    <li key={r.id} className="flex gap-2">
                      <span className="opacity-60">•</span>
                      <span>
                        <span className="font-medium">{r.label}.</span>{" "}
                        <span className="opacity-80">{r.description}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {promptValidation.errors.length === 0 && promptValidation.warnings.length > 0 && !overrideWarnings && (
                  <button
                    type="button"
                    onClick={() => setOverrideWarnings(true)}
                    className="text-[12px] font-semibold underline underline-offset-2 hover:opacity-80"
                  >
                    Save anyway
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {folderChips}

        {optimizedPrompt ? (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOptimizedPrompt(null)}
              className="h-12 rounded-xl flex-1"
              disabled={saving}
            >
              Re-optimize
            </Button>
            <Button
              type="button"
              onClick={handleSaveOptimizedPrompt}
              disabled={
                saving ||
                !optimizedPrompt.trim() ||
                (promptValidation ? !promptValidation.ok : false) ||
                (promptValidation && promptValidation.warnings.length > 0 && !overrideWarnings)
              }
              className="h-12 rounded-xl flex-[2] text-[16px] font-semibold"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save prompt"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onClick={handleOptimizePrompt}
            disabled={optimizing || note.trim().length < 10}
            className="w-full h-12 rounded-xl text-[16px] font-semibold"
          >
            {optimizing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-1.5" />
                Optimize prompt
              </>
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-3 sm:p-4 space-y-3 shadow-sm">
      <SourcePicker value={source} onChange={handleSourceChange} />

      {needsUrl && (
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            URL
          </label>
          <Input
            ref={urlInputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              // Auto-trigger extraction the moment a valid URL is pasted into
              // an empty field. The user then reviews the extracted text in the
              // preview card before committing to save.
              const pasted = e.clipboardData.getData("text").trim();
              if (!pasted || url.trim().length > 0) return;
              try {
                const u = new URL(pasted);
                if (u.protocol !== "http:" && u.protocol !== "https:") return;
              } catch {
                return;
              }
              setUrl(pasted);
              setTimeout(() => handleExtract({ url: pasted }), 0);
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

      {/* URL preview step — shows extracted readable text before saving. */}
      {needsUrl && preview && (
        <div ref={previewRef} className="rounded-2xl border border-border/70 bg-secondary/30 p-3 sm:p-4 space-y-3 scroll-mt-20">
          <div className="flex items-start gap-2">
            <div className="h-9 w-9 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Preview
              </div>
              <div className="font-semibold text-[15px] truncate" title={preview.suggestedTitle || preview.url}>
                {preview.suggestedTitle || "Untitled page"}
              </div>
              <div className="text-[12px] text-muted-foreground truncate" title={preview.url}>
                {preview.url}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="press text-muted-foreground hover:text-foreground p-1.5 -mr-1 -mt-1 rounded-md"
              aria-label="Dismiss preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Editable title for the preview */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional — AI will suggest one)"
            maxLength={200}
            className="h-10 rounded-xl bg-card border-border/60 text-[14px]"
          />

          {/* Editable extracted text — user can trim before saving */}
          <Textarea
            value={preview.text}
            onChange={(e) => setPreview({ ...preview, text: e.target.value })}
            rows={8}
            className="rounded-xl bg-card border-border/60 text-[13.5px] leading-relaxed resize-y max-h-[40vh]"
          />

          <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
            <span>
              {preview.text.length.toLocaleString()} chars ·{" "}
              {preview.text.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} words
            </span>
            <span className="opacity-70">Edit before saving if needed</span>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPreview(null);
                setUrl("");
                setTitle("");
              }}
              className="h-11 rounded-xl flex-1"
              disabled={generating || saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSavePreview}
              disabled={generating || saving || preview.text.trim().length < 20}
              className="h-11 rounded-xl flex-[2] text-[15px] font-semibold"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Summarize & save
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {!preview && (source === "note" || source === "list" || isTranscript) ? (
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
      ) : !preview ? (
        <Input
          ref={noteInputRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={ph.note}
          className="h-16 rounded-2xl bg-secondary/60 border-transparent text-[18px] font-medium px-4 placeholder:font-normal placeholder:text-muted-foreground/70"
        />
      ) : null}

      {!preview && folderChips}

      {!preview && (
        <Button
          onClick={usesAiPreview ? () => handleGenerateAndSave() : handleSave}
          disabled={saving || generating || extracting || createIdea.isPending}
          className="w-full h-12 rounded-xl text-[16px] font-semibold"
        >
          {saving || generating || extracting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1.5" />
              {needsUrl
                ? "Extract preview"
                : isTranscript
                  ? "Save & summarize"
                  : source === "list"
                    ? "Save list"
                    : "Save idea"}
            </>
          )}
        </Button>
      )}
    </div>
  );
};
