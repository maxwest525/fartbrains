import { useEffect, useRef, useState } from "react";
import { Mic, Plus, ArrowUp, Loader2, Square, X, Check, Folder as FolderIcon, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFolders } from "@/hooks/useFolders";
import { useCreateIdea } from "@/hooks/useIdeas";
import { useVoiceCapture, blobToBase64 } from "@/hooks/useVoiceCapture";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

const CHIPS_KEY = "ash-dock-chips-v1";
const FOLDER_KEY = "ash-dock-folder-v1";

const loadChips = (): Chip[] => {
  try {
    const raw = localStorage.getItem(CHIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const titleFromText = (s: string) => {
  const clean = s.trim().replace(/\s+/g, " ");
  if (!clean) return "Untitled";
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  return firstSentence.length > 80 ? firstSentence.slice(0, 77) + "…" : firstSentence;
};

const fmtSeconds = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

export const AshDock = ({ className }: { className?: string }) => {
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();
  const voice = useVoiceCapture({ maxSeconds: 180 });
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(() => {
    try { return localStorage.getItem(FOLDER_KEY); } catch { return null; }
  });
  const [chips, setChips] = useState<Chip[]>(() => loadChips());
  const [chipEditor, setChipEditor] = useState<Chip | null>(null);
  const [chipDraft, setChipDraft] = useState<{ label: string; prefill: string }>({ label: "", prefill: "" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const saveIdea = async (raw: string, source: "manual" | "audio") => {
    const t = raw.trim();
    if (!t) return;
    setSubmitting(true);
    try {
      await createIdea.mutateAsync({
        title: titleFromText(t),
        raw_note: t,
        source_type: source,
        folder_id: folderId,
      });
      setText("");
    } catch (e) {
      // toast handled in hook
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitText = async () => {
    if (!text.trim() || busy) return;
    await saveIdea(text, "manual");
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
        await saveIdea(transcript, "audio");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice capture failed");
    } finally {
      voice.finishProcessing();
    }
  };

  const openNewChip = () => {
    setChipEditor({ id: "", label: "", prefill: "" });
    setChipDraft({ label: "", prefill: "" });
  };

  const openEditChip = (c: Chip) => {
    setChipEditor(c);
    setChipDraft({ label: c.label, prefill: c.prefill });
  };

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
    const next = c.prefill || c.label;
    setText(next);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  return (
    <>
      <div
        className={cn(
          "fixed left-1/2 -translate-x-1/2 z-30 w-[min(48rem,calc(100vw-1rem))]",
          "bottom-[calc(5.75rem+env(safe-area-inset-bottom))] md:bottom-4",
          className,
        )}
      >
        <div className="rounded-2xl border border-border/70 bg-card/85 backdrop-blur-xl shadow-2xl shadow-black/30 ring-1 ring-white/5">
          {/* Input row */}
          <div className="px-3.5 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmitText();
                }
              }}
              placeholder={isRecording ? `Listening… ${fmtSeconds(voice.seconds)}` : "Capture an idea…"}
              rows={1}
              className="w-full resize-none bg-transparent text-[15px] leading-6 placeholder:text-muted-foreground/70 focus:outline-none max-h-40"
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1.5 px-2.5 pb-2">
            {/* Mic */}
            <button
              type="button"
              onClick={handleMic}
              disabled={busy && !isRecording}
              aria-label={isRecording ? "Stop recording" : "Record voice"}
              className={cn(
                "inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors",
                isRecording
                  ? "bg-destructive text-destructive-foreground animate-pulse"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/70",
              )}
            >
              {isVoiceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-4 w-4" />}
            </button>

            {/* Folder picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-full text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors max-w-[10rem]"
                  aria-label="Choose folder"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="truncate">{folderName}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Save to folder</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFolderId(null)}>
                  <FolderIcon className="h-4 w-4 mr-2 opacity-60" />
                  Inbox (no folder)
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
              onClick={handleSubmitText}
              disabled={!text.trim() || busy}
              aria-label="Save idea"
              className={cn(
                "inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors",
                text.trim() && !busy
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-secondary/60 text-muted-foreground cursor-not-allowed",
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Chip row */}
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
          <button
            type="button"
            onClick={openNewChip}
            className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/40"
            aria-label="Add chip"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
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
