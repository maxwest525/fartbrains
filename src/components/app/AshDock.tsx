import { useEffect, useRef, useState } from "react";
import {
  Mic, ArrowUp, Loader2, Square, X, Check,
  Folder as FolderIcon, Pencil, Trash2,
  ChevronDown, ChevronUp, Wand2, FileText, Instagram, Globe, ListChecks,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useFolders } from "@/hooks/useFolders";
import { useCreateIdea } from "@/hooks/useIdeas";
import { useVoiceCapture, blobToBase64 } from "@/hooks/useVoiceCapture";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeExtraction, summarizeKindFor } from "@/lib/extractedContent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Chip = { id: string; label: string; prefill: string };
type Mode = "auto" | "note" | "list" | "transcript" | "link" | "instagram";

const CHIPS_KEY = "ash-dock-chips-v1";
const FOLDER_KEY = "ash-dock-folder-v1";
const SIDE_KEY = "ash-dock-side-v1";
const COLLAPSED_KEY = "ash-dock-collapsed-v1";

type Side = "left" | "center" | "right";


const loadChips = (): Chip[] => {
  try {
    const raw = localStorage.getItem(CHIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const titleFromText = (s: string) => {
  const clean = s.trim().replace(/\s+/g, " ");
  if (!clean) return "Untitled";
  const first = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  return first.length > 80 ? first.slice(0, 77) + "…" : first;
};

const fmtSeconds = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const URL_RE = /\bhttps?:\/\/[^\s]+/i;

const extractUrl = (s: string): string | null => {
  const m = s.match(URL_RE);
  return m ? m[0] : null;
};

const isInstagramUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    return /(^|\.)instagram\.com$/.test(u.hostname.toLowerCase().replace(/^www\./, ""));
  } catch { return false; }
};

const looksLikeList = (s: string): boolean => {
  const lines = s.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const bulletish = lines.filter((l) => /^([-*•]|\d+[.)])\s+/.test(l)).length;
  return bulletish / lines.length >= 0.6;
};

const linesToChecklist = (s: string): string =>
  s.split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => /^- \[[ xX]\] /.test(l) ? l : `- [ ] ${l.replace(/^([-*•]|\d+[.)])\s+/, "")}`)
    .join("\n");

const MODE_META: Record<Exclude<Mode, "auto">, { label: string; icon: typeof FileText }> = {
  note:       { label: "Note",         icon: FileText },
  list:       { label: "Checklist",    icon: ListChecks },
  transcript: { label: "Transcript",   icon: FileText },
  link:       { label: "Web link",     icon: Globe },
  instagram:  { label: "Instagram",    icon: Instagram },
};

export const AshDock = ({ className }: { className?: string }) => {
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();
  const voice = useVoiceCapture({ maxSeconds: 180 });
  const [text, setText] = useState("");
  // Auto-grow up to 2 lines (~48px), then scroll inside.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 48) + "px";
  }, [text]);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<Mode>("auto");
  const [folderId, setFolderId] = useState<string | null>(() => {
    try { return localStorage.getItem(FOLDER_KEY); } catch { return null; }
  });
  const [chips, setChips] = useState<Chip[]>(() => loadChips());
  const [chipEditor, setChipEditor] = useState<Chip | null>(null);
  const [chipDraft, setChipDraft] = useState<{ label: string; prefill: string }>({ label: "", prefill: "" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  const [side, setSide] = useState<Side>(() => {
    try {
      const v = localStorage.getItem(SIDE_KEY);
      return v === "left" || v === "right" || v === "center" ? v : "left";
    } catch { return "left"; }
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(SIDE_KEY, side); } catch { /* ignore */ }
  }, [side]);
  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  // Publish dock height as a CSS var so pages can pad around it.
  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      document.body.style.setProperty("--ash-dock-h", `${Math.ceil(h)}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      document.body.style.removeProperty("--ash-dock-h");
    };
  }, [collapsed]);

  useEffect(() => {
    try {
      if (folderId) localStorage.setItem(FOLDER_KEY, folderId);
      else localStorage.removeItem(FOLDER_KEY);
    } catch { /* ignore */ }
  }, [folderId]);
  useEffect(() => {
    try { localStorage.setItem(CHIPS_KEY, JSON.stringify(chips)); } catch { /* ignore */ }
  }, [chips]);





  const folderName = folderId ? folders.find((f) => f.id === folderId)?.name ?? "Inbox" : "Inbox";

  const isRecording = voice.state === "recording";
  const isVoiceBusy = voice.state === "requesting" || voice.state === "processing";
  const busy = submitting || isVoiceBusy;

  // Resolve the actual handler from current mode + text shape.
  const detectedMode = (): Exclude<Mode, "auto"> => {
    if (mode !== "auto") return mode;
    const url = extractUrl(text);
    if (url) return isInstagramUrl(url) ? "instagram" : "link";
    if (looksLikeList(text)) return "list";
    if (text.trim().length > 400) return "transcript";
    return "note";
  };

  const handleSubmit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    const eff = detectedMode();
    setSubmitting(true);
    try {
      if (eff === "link" || eff === "instagram") {
        await saveUrlIdea(extractUrl(t) ?? t, eff);
      } else if (eff === "transcript") {
        await saveTranscriptIdea(t);
      } else if (eff === "list") {
        await createIdea.mutateAsync({
          title: titleFromText(t),
          raw_note: linesToChecklist(t),
          source_type: "manual",
          folder_id: folderId,
          tags: ["list"],
        });
      } else {
        await createIdea.mutateAsync({
          title: titleFromText(t),
          raw_note: t,
          source_type: "manual",
          folder_id: folderId,
        });
      }
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSubmitting(false);
    }
  };

  const saveUrlIdea = async (url: string, kind: "link" | "instagram") => {
    const isInsta = kind === "instagram" || isInstagramUrl(url);
    const fnName = isInsta ? "transcribe-instagram" : "extract-url";
    const { data: ext, error: extErr } = await supabase.functions.invoke(fnName, { body: { url } });
    if (extErr) throw new Error(extErr.message);
    if (ext?.error) throw new Error(ext.error);
    const normalized = normalizeExtraction(isInsta ? "instagram" : "webpage", ext, url);

    let summary = "";
    let aiTitle: string | undefined;
    try {
      const { data: sum, error: sumErr } = await supabase.functions.invoke("summarize", {
        body: { text: normalized.text, kind: summarizeKindFor(normalized.sourceKind) },
      });
      if (sumErr) throw new Error(sumErr.message);
      if (sum?.error) throw new Error(sum.error);
      summary = sum?.summary ?? "";
      aiTitle = sum?.suggestedTitle ?? undefined;
    } catch (e) {
      toast.warning(e instanceof Error ? `Summary failed: ${e.message}` : "Summary failed");
    }

    await createIdea.mutateAsync({
      title: (aiTitle || normalized.suggestedTitle || normalized.url).slice(0, 200),
      source_url: normalized.url,
      source_type: "webpage",
      source_label: normalized.siteName ?? (
        normalized.sourceKind === "instagram" ? "Instagram" :
        normalized.sourceKind === "tiktok"    ? "TikTok"    :
        normalized.sourceKind === "youtube"   ? "YouTube"   : "Web page"
      ),
      source_meta: {
        kind: normalized.sourceKind,
        author: normalized.author,
        siteName: normalized.siteName,
        thumbnail: normalized.thumbnail,
        hasTranscript: normalized.hasTranscript,
      },
      extracted_text: normalized.text || null,
      ai_summary: summary.trim() || null,
      folder_id: folderId,
    });
  };

  const saveTranscriptIdea = async (raw: string) => {
    let summary = "";
    let aiTitle: string | undefined;
    try {
      const { data: sum, error: sumErr } = await supabase.functions.invoke("summarize", {
        body: { text: raw, kind: "transcript" },
      });
      if (sumErr) throw new Error(sumErr.message);
      if (sum?.error) throw new Error(sum.error);
      summary = sum?.summary ?? "";
      aiTitle = sum?.suggestedTitle ?? undefined;
    } catch (e) {
      toast.warning(e instanceof Error ? `Summary failed: ${e.message}` : "Summary failed");
    }
    await createIdea.mutateAsync({
      title: (aiTitle || titleFromText(raw)).slice(0, 200),
      source_type: "transcript",
      extracted_text: raw,
      ai_summary: summary.trim() || null,
      folder_id: folderId,
    });
  };

  const handleMic = async () => {
    try {
      if (voice.state === "idle") {
        await voice.start();
        return;
      }
      if (voice.state === "recording") {
        const { blob, mimeType } = await voice.stop();
        if (blob.size < 800) {
          toast.error("Too short — hold the mic a bit longer.");
          voice.finishProcessing();
          return;
        }
        const audioBase64 = await blobToBase64(blob);
        const { data, error } = await supabase.functions.invoke("transcribe-deliverables", {
          body: { audioBase64, mimeType, allowedTypes: ["other"] },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        const transcript: string = typeof data?.transcript === "string" ? data.transcript : "";
        if (!transcript.trim()) {
          toast.message("Nothing heard — try again.");
          return;
        }
        await createIdea.mutateAsync({
          title: titleFromText(transcript),
          raw_note: transcript,
          source_type: "audio",
          folder_id: folderId,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice capture failed");
    } finally {
      voice.finishProcessing();
    }
  };

  const openNewChip = () => { setChipEditor({ id: "", label: "", prefill: "" }); setChipDraft({ label: "", prefill: "" }); };
  const openEditChip = (c: Chip) => { setChipEditor(c); setChipDraft({ label: c.label, prefill: c.prefill }); };
  const saveChip = () => {
    if (!chipEditor) return;
    const label = chipDraft.label.trim();
    if (!label) return;
    if (chipEditor.id) {
      setChips((cs) => cs.map((c) => c.id === chipEditor.id ? { ...c, label, prefill: chipDraft.prefill } : c));
    } else {
      setChips((cs) => [...cs, { id: crypto.randomUUID(), label, prefill: chipDraft.prefill }]);
    }
    setChipEditor(null);
  };
  const deleteChip = () => {
    if (!chipEditor?.id) return;
    setChips((cs) => cs.filter((c) => c.id !== chipEditor.id));
    setChipEditor(null);
  };
  const useChip = (c: Chip) => {
    setText(c.prefill || c.label);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  // Show the active mode as a chip on the left of the input row.
  const effectiveMode = text.trim() ? detectedMode() : (mode === "auto" ? "note" : mode);
  const ModeIcon = MODE_META[effectiveMode].icon;
  const modeLabel = mode === "auto" ? `Auto · ${MODE_META[effectiveMode].label}` : MODE_META[effectiveMode].label;

  const sideClass =
    side === "left"  ? "left-2 right-auto translate-x-0" :
    side === "right" ? "right-2 left-auto translate-x-0" :
                       "left-1/2 -translate-x-1/2";

  return (
    <>
      <div
        ref={dockRef}
        className={cn(
          "fixed z-30 w-[min(48rem,calc(100vw-1rem))]",
          sideClass,
          "bottom-[calc(3.25rem+env(safe-area-inset-bottom))] md:bottom-4",
          className,
        )}
      >

        <div className="gemini gemini-ring rounded-2xl bg-card/85 backdrop-blur-xl shadow-2xl shadow-black/30 transition-all">
          {/* Header strip — side toggle + collapse */}
          <div className="flex items-center gap-1 px-2 pt-1.5">
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
              aria-controls="ash-dock-body"
              aria-label={collapsed ? "Expand dock" : "Collapse dock"}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors"
            >
              {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {collapsed ? (
            <div id="ash-dock-body" className="flex items-center gap-1.5 px-2.5 pb-2 pt-0.5">
              <button
                type="button"
                onClick={handleMic}
                disabled={busy && !isRecording}
                aria-label={isRecording ? "Stop recording" : "Record voice"}
                className={cn(
                  "inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors shrink-0",
                  isRecording
                    ? "bg-destructive text-destructive-foreground animate-pulse"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/70",
                )}
              >
                {isVoiceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                className="flex-1 h-9 text-left px-2 text-[12.5px] text-muted-foreground hover:text-foreground truncate"
              >
                Tap to capture…
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!text.trim() || busy}
                aria-label="Save idea"
                className={cn(
                  "inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors shrink-0",
                  text.trim() && !busy
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-secondary/60 text-muted-foreground cursor-not-allowed",
                )}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          ) : (
          <div id="ash-dock-body">
          {/* Input */}

          <div className="px-3.5 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.metaKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder={isRecording ? `Listening… ${fmtSeconds(voice.seconds)}` : "Capture an idea, paste a link, drop a transcript…"}
              rows={1}
              className="w-full resize-none bg-transparent text-[15px] leading-6 placeholder:text-muted-foreground/70 focus:outline-none max-h-12 overflow-y-auto"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 px-2.5 pb-2">
            {/* Mic */}
            <button
              type="button"
              onClick={handleMic}
              disabled={busy && !isRecording}
              aria-label={isRecording ? "Stop recording" : "Record voice"}
              className={cn(
                "inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors shrink-0",
                isRecording
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/70",
              )}
            >
              {isVoiceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
            </button>

            {/* Mode picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 h-9 px-2.5 rounded-full text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors shrink-0"
                  aria-label="Capture type"
                >
                  <ModeIcon className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[8rem]">{modeLabel}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuLabel>Capture type</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setMode("auto")}>
                  <Wand2 className="h-4 w-4 mr-2 opacity-60" /> Auto-detect
                  {mode === "auto" && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {(["note","list","transcript","link","instagram"] as const).map((k) => {
                  const Icon = MODE_META[k].icon;
                  return (
                    <DropdownMenuItem key={k} onClick={() => setMode(k)}>
                      <Icon className="h-4 w-4 mr-2 opacity-60" /> {MODE_META[k].label}
                      {mode === k && <Check className="h-4 w-4 ml-auto" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Folder picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 h-9 px-2.5 rounded-full text-[12.5px] text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors max-w-[9rem]"
                  aria-label="Choose folder"
                >
                  <FolderIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{folderName}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Save to folder</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFolderId(null)}>
                  <FolderIcon className="h-4 w-4 mr-2 opacity-60" /> Inbox (no folder)
                  {folderId === null && <Check className="h-4 w-4 ml-auto" />}
                </DropdownMenuItem>
                {folders.length > 0 && <DropdownMenuSeparator />}
                <div className="max-h-64 overflow-y-auto">
                  {folders.map((f) => (
                    <DropdownMenuItem key={f.id} onClick={() => setFolderId(f.id)}>
                      <FolderIcon className="h-4 w-4 mr-2 opacity-60" />
                      <span className="truncate">{f.name}</span>
                      {folderId === f.id && <Check className="h-4 w-4 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            {/* Send */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!text.trim() || busy}
              aria-label="Save idea"
              className={cn(
                "inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors shrink-0",
                text.trim() && !busy
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary/60 text-muted-foreground cursor-not-allowed",
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
          </div>
          )}
        </div>


        {/* Chips */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 px-1">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => useChip(c)}
              onContextMenu={(e) => { e.preventDefault(); openEditChip(c); }}
              className="group inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-secondary/70 hover:bg-secondary text-[12px] text-foreground/90 border border-border/50"
              title="Click to use · right-click to edit"
            >
              <span className="truncate max-w-[10rem]">{c.label}</span>
              <Pencil
                className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity"
                onClick={(e) => { e.stopPropagation(); openEditChip(c); }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Chip editor */}
      <Dialog open={!!chipEditor} onOpenChange={(o) => !o && setChipEditor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{chipEditor?.id ? "Edit chip" : "New chip"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Label</label>
              <Input
                autoFocus
                value={chipDraft.label}
                onChange={(e) => setChipDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="e.g. Morning thought"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Prefill text (optional)</label>
              <textarea
                value={chipDraft.prefill}
                onChange={(e) => setChipDraft((d) => ({ ...d, prefill: e.target.value }))}
                placeholder="Text that fills the input when you tap this chip"
                className="w-full mt-1 rounded-md bg-secondary/60 border border-border px-3 py-2 text-sm min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between">
            {chipEditor?.id ? (
              <Button variant="ghost" size="sm" onClick={deleteChip} className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            ) : <div />}
            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" size="sm" onClick={() => setChipEditor(null)}>
                <X className="h-4 w-4 mr-1.5" /> Cancel
              </Button>
              <Button size="sm" onClick={saveChip} disabled={!chipDraft.label.trim()}>
                <Check className="h-4 w-4 mr-1.5" /> Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
