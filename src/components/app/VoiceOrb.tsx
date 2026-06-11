import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mic, Square, Loader2, Check, X, Undo2, Redo2, Search, Replace as ReplaceIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceCapture, blobToBase64 } from "@/hooks/useVoiceCapture";
import { useCreateIdea } from "@/hooks/useIdeas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FOLDER_KEY = "ash-dock-folder-v1";
const DRAFT_KEY = "voice-orb-draft-v1";

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

const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const VoiceOrb = () => {
  const voice = useVoiceCapture({ maxSeconds: 180 });
  const createIdea = useCreateIdea();
  const [submitting, setSubmitting] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);

  // Draft state — persisted so user doesn't lose edits when recording again
  // or switching folders. `null` = no editor open.
  const [draft, setDraft] = useState<string | null>(() => {
    try { return localStorage.getItem(DRAFT_KEY); } catch { return null; }
  });
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]);
  const lastPushRef = useRef<number>(0);

  // Find/replace
  const [showFind, setShowFind] = useState(false);
  const [findTerm, setFindTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try { setFolderId(localStorage.getItem(FOLDER_KEY)); } catch { /* ignore */ }
    const onStorage = (e: StorageEvent) => {
      if (e.key === FOLDER_KEY) setFolderId(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Persist draft across reloads / re-records / folder switches.
  useEffect(() => {
    try {
      if (draft && draft.trim()) localStorage.setItem(DRAFT_KEY, draft);
      else localStorage.removeItem(DRAFT_KEY);
    } catch { /* ignore */ }
  }, [draft]);

  const isRecording = voice.state === "recording";
  const isTranscribing = voice.state === "requesting" || voice.state === "processing";
  const isBusy = isTranscribing || submitting;

  // History helpers — coalesce edits within 600ms into a single undo step.
  const pushHistory = useCallback((prev: string) => {
    const now = Date.now();
    if (now - lastPushRef.current < 600) return;
    lastPushRef.current = now;
    setHistory((h) => [...h.slice(-49), prev]);
    setFuture([]);
  }, []);

  const updateDraft = useCallback((next: string) => {
    setDraft((prev) => {
      if (prev !== null && prev !== next) pushHistory(prev);
      return next;
    });
  }, [pushHistory]);

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [draft ?? "", ...f]);
      setDraft(prev);
      return h.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h, draft ?? ""]);
      setDraft(next);
      return f.slice(1);
    });
  };

  const onTap = async () => {
    try {
      if (voice.state === "idle") {
        await voice.start();
        return;
      }
      if (voice.state === "recording") {
        const { blob, mimeType } = await voice.stop();
        if (blob.size < 800) {
          toast.error("Too short — hold a bit longer.");
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
        // Append to any existing draft so prior edits aren't lost.
        setDraft((prev) => {
          if (prev && prev.trim()) {
            pushHistory(prev);
            return `${prev.trim()}\n\n${transcript.trim()}`;
          }
          return transcript.trim();
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice capture failed");
    } finally {
      voice.finishProcessing();
    }
  };

  const saveDraft = async () => {
    const raw = (draft ?? "").trim();
    if (!raw) return;
    setSubmitting(true);

    // Run summarization on the edited text so AI summary matches what the user saved.
    let summary = "";
    let aiTitle: string | undefined;
    try {
      const { data: sum, error: sumErr } = await supabase.functions.invoke("summarize", {
        body: { text: raw, kind: "transcript" },
      });
      if (sumErr) throw new Error(sumErr.message);
      if (sum?.error) throw new Error(sum.error);
      summary = (sum?.summary ?? "").trim();
      aiTitle = sum?.suggestedTitle ?? undefined;
    } catch (e) {
      toast.warning(e instanceof Error ? `Summary failed: ${e.message}` : "Summary failed");
    }

    try {
      await createIdea.mutateAsync({
        title: (aiTitle || titleFromText(raw)).slice(0, 200),
        raw_note: raw,
        extracted_text: raw,
        ai_summary: summary || null,
        source_type: "audio",
        folder_id: folderId,
      });
      toast.success("Idea saved");
      setDraft(null);
      setHistory([]);
      setFuture([]);
      setShowFind(false);
      setFindTerm("");
      setReplaceTerm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const discard = () => {
    setDraft(null);
    setHistory([]);
    setFuture([]);
    setShowFind(false);
  };

  const findNext = () => {
    const el = textareaRef.current;
    if (!el || !findTerm || !draft) return;
    const from = el.selectionEnd ?? 0;
    const idx = draft.toLowerCase().indexOf(findTerm.toLowerCase(), from);
    const wrap = idx === -1 ? draft.toLowerCase().indexOf(findTerm.toLowerCase()) : idx;
    if (wrap === -1) {
      toast.message("Not found");
      return;
    }
    el.focus();
    el.setSelectionRange(wrap, wrap + findTerm.length);
  };

  const replaceAll = () => {
    if (!findTerm || draft === null) return;
    const re = new RegExp(escapeRe(findTerm), "gi");
    const next = draft.replace(re, replaceTerm);
    if (next === draft) {
      toast.message("Nothing to replace");
      return;
    }
    updateDraft(next);
    toast.success("Replaced");
  };

  const wordCount = useMemo(() => countWords(draft ?? ""), [draft]);
  const charCount = (draft ?? "").length;

  const status = isRecording
    ? `Listening · ${fmtSeconds(voice.seconds)}`
    : isTranscribing
      ? "Transcribing…"
      : draft !== null
        ? "Review & edit"
        : "Tap to speak";

  return (
    <div className="dark relative flex flex-col items-center justify-center gap-5 sm:gap-6 py-6 sm:py-8 px-3 sm:px-6 rounded-2xl sm:rounded-3xl bg-[hsl(222_18%_8%)] text-[hsl(220_14%_96%)] overflow-hidden w-full">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 45%, hsl(217 91% 65% / 0.18), transparent 70%)",
        }}
      />

      <button
        type="button"
        onClick={onTap}
        disabled={isBusy}
        aria-label={isRecording ? "Stop recording" : "Start voice capture"}
        className={cn(
          "relative h-28 w-28 sm:h-40 sm:w-40 md:h-44 md:w-44 rounded-full flex items-center justify-center select-none transition-transform active:scale-[0.97]",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40",
          isBusy && "opacity-80",
        )}
      >
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
            <span className="absolute -inset-3 rounded-full bg-primary/10 animate-pulse" />
          </>
        )}

        <span
          className={cn(
            "absolute inset-0 rounded-full",
            "shadow-[0_20px_60px_-10px_hsl(217_91%_50%/0.55),inset_0_1px_0_hsl(0_0%_100%/0.18)]",
          )}
          style={{
            background: isRecording
              ? "radial-gradient(circle at 30% 30%, hsl(0 78% 65%), hsl(0 78% 45%) 60%, hsl(0 78% 28%) 100%)"
              : "radial-gradient(circle at 30% 30%, hsl(217 95% 72%), hsl(217 91% 53%) 55%, hsl(222 70% 22%) 100%)",
          }}
        />
        <span
          aria-hidden
          className="absolute left-1/2 top-3 h-8 sm:h-10 w-20 sm:w-24 -translate-x-1/2 rounded-full bg-white/25 blur-md"
        />

        <span className="relative z-10 text-white">
          {isTranscribing ? (
            <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 animate-spin" />
          ) : isRecording ? (
            <Square className="h-8 w-8 sm:h-10 sm:w-10 fill-current" />
          ) : (
            <Mic className="h-10 w-10 sm:h-12 sm:w-12" strokeWidth={2.2} />
          )}
        </span>
      </button>

      <div className="relative text-center space-y-1">
        <p className="text-[14px] sm:text-[15px] font-medium tracking-tight">{status}</p>
        {draft === null && (
          <p className="text-[12px] sm:text-[12.5px] text-[hsl(220_9%_65%)]">
            Speak your idea — edit before saving.
          </p>
        )}
        {draft !== null && !isRecording && !isTranscribing && (
          <p className="text-[11.5px] text-[hsl(220_9%_60%)]">
            Tap orb to add more — your edits are kept.
          </p>
        )}
      </div>

      {draft !== null && (
        <div className="relative w-full max-w-lg space-y-2.5">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-center gap-0.5">
              <Button
                type="button" variant="ghost" size="sm"
                onClick={undo} disabled={history.length === 0}
                className="h-8 px-2 text-[hsl(220_9%_75%)] hover:text-white hover:bg-white/5"
                aria-label="Undo"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                onClick={redo} disabled={future.length === 0}
                className="h-8 px-2 text-[hsl(220_9%_75%)] hover:text-white hover:bg-white/5"
                aria-label="Redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                onClick={() => setShowFind((s) => !s)}
                className={cn(
                  "h-8 px-2 hover:bg-white/5",
                  showFind ? "text-white bg-white/5" : "text-[hsl(220_9%_75%)] hover:text-white",
                )}
                aria-label="Find and replace"
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>
            <span className="text-[11px] tabular-nums text-[hsl(220_9%_60%)]">
              {wordCount} {wordCount === 1 ? "word" : "words"} · {charCount} chars
            </span>
          </div>

          {showFind && (
            <div className="rounded-lg border border-[hsl(222_14%_22%)] bg-[hsl(222_14%_10%)] p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Input
                  value={findTerm}
                  onChange={(e) => setFindTerm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); findNext(); } }}
                  placeholder="Find"
                  className="h-8 bg-[hsl(222_14%_12%)] border-[hsl(222_14%_22%)] text-[13px]"
                />
                <Button type="button" size="sm" variant="ghost" onClick={findNext}
                  className="h-8 px-2 text-[hsl(220_9%_75%)] hover:text-white hover:bg-white/5">
                  Next
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  value={replaceTerm}
                  onChange={(e) => setReplaceTerm(e.target.value)}
                  placeholder="Replace with"
                  className="h-8 bg-[hsl(222_14%_12%)] border-[hsl(222_14%_22%)] text-[13px]"
                />
                <Button type="button" size="sm" variant="ghost" onClick={replaceAll}
                  className="h-8 px-2 text-[hsl(220_9%_75%)] hover:text-white hover:bg-white/5">
                  <ReplaceIcon className="h-3.5 w-3.5 mr-1" /> All
                </Button>
              </div>
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => updateDraft(e.target.value)}
            autoFocus
            rows={6}
            className="bg-[hsl(222_14%_12%)] border-[hsl(222_14%_22%)] text-[hsl(220_14%_96%)] placeholder:text-[hsl(220_9%_55%)] text-[14px] leading-relaxed resize-none min-h-[140px] sm:min-h-[160px]"
            placeholder="Transcript…"
          />

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={discard}
              disabled={submitting}
              className="text-[hsl(220_9%_75%)] hover:text-white hover:bg-white/5"
            >
              <X className="h-4 w-4 mr-1.5" /> Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveDraft}
              disabled={submitting || !draft.trim()}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-1.5" />
              )}
              Save idea
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
