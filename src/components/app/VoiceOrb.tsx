import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mic, Square, Loader2, Check, X, Undo2, Redo2, Search, Replace as ReplaceIcon,
  Radio, Send, Keyboard, ShieldAlert, ShieldCheck, ShieldQuestion,
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

// Shared toolbar/footer button styling — keeps focus, hover, and disabled
// states accessible in the Gemini dark theme.
const toolbarBtn = cn(
  "h-8 px-2 rounded-full transition-colors",
  "text-[color:var(--g-text-soft)]",
  "hover:text-white hover:bg-white/[0.08]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--g-focus-ring)] focus-visible:ring-offset-0",
  "disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[color:var(--g-text-disabled)] disabled:cursor-not-allowed",
);

type CaptureMode = "dictate" | "record" | "live";

type VoiceOrbProps = {
  /** Send a transcript into the bottom composer (dictate mode). */
  onDictate?: (text: string) => void;
  /** Fired with a transcript when in Live mode (sent to Ash chat). */
  onLiveTranscript?: (text: string) => void;
  /** True while Ash is speaking back — animates the orb in a different color. */
  speaking?: boolean;
};

export const VoiceOrb = ({ onDictate, onLiveTranscript, speaking = false }: VoiceOrbProps) => {
  const voice = useVoiceCapture({ maxSeconds: 180 });
  const createIdea = useCreateIdea();
  const [submitting, setSubmitting] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [mode, setMode] = useState<CaptureMode>("dictate");

  // Mic permission status — surfaced as a small chip so users know why a tap
  // does nothing when the browser has blocked the mic.
  type MicPerm = "unknown" | "prompt" | "granted" | "denied";
  const [micPerm, setMicPerm] = useState<MicPerm>("unknown");
  useEffect(() => {
    let cancelled = false;
    const navAny = navigator as Navigator & { permissions?: { query: (q: { name: PermissionName }) => Promise<PermissionStatus> } };
    if (!navAny.permissions?.query) return;
    navAny.permissions.query({ name: "microphone" as PermissionName })
      .then((status) => {
        if (cancelled) return;
        setMicPerm(status.state as MicPerm);
        status.onchange = () => setMicPerm(status.state as MicPerm);
      })
      .catch(() => { /* unsupported — leave unknown */ });
    return () => { cancelled = true; };
  }, []);

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
  const editorRef = useRef<HTMLDivElement>(null);

  // Keyboard-aware editor height (mobile). Falls back to fixed heights on desktop.
  const [editorHeight, setEditorHeight] = useState<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const recompute = () => {
      // Only adjust on narrow viewports — desktop keeps the fixed size.
      if (window.innerWidth >= 640) { setEditorHeight(null); return; }
      const card = editorRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      // Distance from top of card to bottom of visible (visual) viewport.
      const available = vv.height - rect.top + vv.offsetTop - 12; // 12px breathing room
      // Clamp so the editor never collapses below a usable height.
      setEditorHeight(Math.max(180, Math.min(available, 420)));
    };
    recompute();
    vv.addEventListener("resize", recompute);
    vv.addEventListener("scroll", recompute);
    window.addEventListener("resize", recompute);
    return () => {
      vv.removeEventListener("resize", recompute);
      vv.removeEventListener("scroll", recompute);
      window.removeEventListener("resize", recompute);
    };
  }, [draft, showFind]);

  // Bring textarea into view when keyboard appears.
  const onTextareaFocus = () => {
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  // Prevent toolbar buttons from stealing focus from the textarea, so the
  // mobile keyboard stays open while undo/redo/find are tapped.
  const keepFocus = (fn: () => void) => (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    fn();
    requestAnimationFrame(() => textareaRef.current?.focus());
  };


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
        if (micPerm === "denied") {
          toast.error("Microphone is blocked. Enable mic access in your browser settings.");
          return;
        }
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

        // RECORD mode: save the voice note as an idea without transcribing.
        if (mode === "record") {
          setSubmitting(true);
          try {
            const seconds = Math.max(1, Math.round(blob.size / 16000));
            await createIdea.mutateAsync({
              title: `Voice note · ${fmtSeconds(seconds)}`,
              raw_note: `Voice note (${fmtSeconds(seconds)}) — saved without transcription.`,
              source_type: "audio",
              folder_id: folderId,
            });
            toast.success("Voice note saved");
          } finally {
            setSubmitting(false);
          }
          return;
        }

        // DICTATE / LIVE: transcribe.
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

        if (mode === "live" && onLiveTranscript) {
          onLiveTranscript(transcript.trim());
          return;
        }

        // DICTATE: push into the bottom composer instead of opening the draft editor.
        if (mode === "dictate") {
          if (onDictate) onDictate(transcript.trim());
          else {
            window.dispatchEvent(new CustomEvent("idea-vault:dictate", { detail: transcript.trim() }));
          }
          toast.success("Added to composer");
          return;
        }
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

  const modeCopy: Record<CaptureMode, { idle: string; hint: string }> = {
    dictate: { idle: "Tap for voice to text", hint: "Transcribes your speech into the composer below." },
    record:  { idle: "Tap for voice prompt",  hint: "Records a voice prompt and sends it to Ash." },
    live:    { idle: "Tap to talk to Ash",    hint: "Ash listens, replies, and speaks back." },
  };

  const status = isRecording
    ? `Listening · ${fmtSeconds(voice.seconds)}`
    : isTranscribing
      ? mode === "record" ? "Saving…" : "Transcribing…"
      : speaking
        ? "Ash is speaking…"
        : draft !== null
          ? "Review & edit"
          : modeCopy[mode].idle;

  const permMeta = micPerm === "granted"
    ? { Icon: ShieldCheck, label: "Mic ready", tone: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30" }
    : micPerm === "denied"
      ? { Icon: ShieldAlert, label: "Mic blocked", tone: "text-red-300 bg-red-400/10 border-red-400/40" }
      : micPerm === "prompt"
        ? { Icon: ShieldQuestion, label: "Mic permission needed", tone: "text-amber-200 bg-amber-400/10 border-amber-400/30" }
        : { Icon: ShieldQuestion, label: "Tap to allow mic", tone: "text-white/60 bg-white/[0.04] border-white/10" };

  const modeBtns: Array<{ id: CaptureMode; label: string; Icon: typeof Mic; tone: string }> = [
    { id: "dictate", label: "Voice to Text", Icon: Keyboard, tone: "from-[#9B72CB] to-[#4285F4]" },
    { id: "record",  label: "Voice Prompt",  Icon: Send,     tone: "from-[#D96570] to-[#F2A4AC]" },
    { id: "live",    label: "Live",          Icon: Radio,    tone: "from-[#4285F4] to-[#9B72CB]" },
  ];

  return (
    <div className="gemini dark relative flex flex-col items-center justify-center gap-5 sm:gap-6 py-6 sm:py-8 px-3 sm:px-6 text-[color:var(--g-text)] w-full">
      {/* Full-screen ambient Gemini glow — sits behind the entire capture page */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(155,114,203,0.28), transparent 70%), radial-gradient(45% 40% at 20% 75%, rgba(66,133,244,0.22), transparent 75%), radial-gradient(45% 40% at 80% 80%, rgba(217,101,112,0.18), transparent 75%), linear-gradient(180deg, #0a0a14 0%, #05050b 100%)",
        }}
      />

      {/* Mic permission status — plain text + icon, no pill */}
      <div className={cn("relative inline-flex items-center gap-1.5 text-[11.5px] font-medium", permMeta.tone.split(" ")[0])}>
        <permMeta.Icon className="h-3.5 w-3.5" />
        {permMeta.label}
      </div>


      <button
        type="button"
        onClick={onTap}
        disabled={isBusy}
        aria-label={isRecording ? "Stop recording" : "Start voice capture"}
        className={cn(
          "relative h-28 w-28 sm:h-40 sm:w-40 md:h-44 md:w-44 rounded-full flex items-center justify-center select-none transition-transform active:scale-[0.97]",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--g-focus-ring)]",
          isBusy && "opacity-80 cursor-not-allowed",
        )}
      >
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-[color:var(--g-red)]/30 animate-ping" />
            <span className="absolute -inset-3 rounded-full bg-[color:var(--g-red)]/10 animate-pulse" />
          </>
        )}

        {speaking && !isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-[#4285F4]/30 animate-ping" />
            <span className="absolute -inset-3 rounded-full bg-[#9B72CB]/15 animate-pulse" />
          </>
        )}

        <span
          aria-hidden
          className="absolute -inset-[2px] rounded-full opacity-90 blur-[1px]"
          style={{
            background: "var(--g-conic)",
            animation: `gemini-spin ${speaking ? "2s" : "6s"} linear infinite`,
          }}
        />

        <span
          className={cn(
            "absolute inset-0 rounded-full",
            "shadow-[0_24px_60px_-12px_rgba(155,114,203,0.55),inset_0_1px_0_rgba(255,255,255,0.14)]",
            !isRecording && !isTranscribing && !speaking && "gemini-hue-cycle",
          )}
          style={{
            background: isRecording
              ? "radial-gradient(circle at 30% 30%, #F2A4AC, #D96570 55%, #5A1F26 100%)"
              : speaking
                ? "radial-gradient(circle at 30% 30%, #A4C7F2, #4285F4 55%, #1A3A7A 100%)"
                : "var(--g-gradient)",
          }}
        />

        <span
          aria-hidden
          className="absolute left-1/2 top-3 h-7 sm:h-9 w-20 sm:w-24 -translate-x-1/2 rounded-full bg-white/30 blur-md"
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

      <div className="relative text-center space-y-1.5">
        <p className="text-[14px] sm:text-[15px] font-medium tracking-tight">{status}</p>
        {draft === null && (
          <p className="text-[12px] sm:text-[12.5px] text-[color:var(--g-text-muted)]">
            {modeCopy[mode].hint}
          </p>
        )}
        {draft !== null && !isRecording && !isTranscribing && (
          <p className="text-[11.5px] text-[color:var(--g-text-muted)]">
            Tap orb to add more — your edits are kept.
          </p>
        )}
      </div>

      {/* 3-mode segmented selector */}
      <div
        role="tablist"
        aria-label="Capture mode"
        className="relative flex items-center gap-1.5 p-1.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_30px_-12px_rgba(0,0,0,0.6)]"
      >
        {modeBtns.map(({ id, label, Icon, tone }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setMode(id)}
              disabled={isRecording || isTranscribing}
              className={cn(
                "relative inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12.5px] font-medium transition-all",
                active
                  ? `text-white bg-gradient-to-r ${tone} shadow-[0_6px_20px_-6px_rgba(155,114,203,0.7)]`
                  : "text-white/65 hover:text-white hover:bg-white/[0.06]",
                (isRecording || isTranscribing) && !active && "opacity-40",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>


      {draft !== null && (
        <div className="relative w-full max-w-lg">
          <div
            ref={editorRef}
            className="gemini-ring flex flex-col rounded-3xl bg-[color:var(--g-surface-1)] overflow-hidden shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]"
            style={{ height: editorHeight ?? undefined }}
          >
            {/* Sticky toolbar */}
            <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-[color:var(--g-border)] bg-[color:var(--g-surface-1)]/95 backdrop-blur shrink-0 sticky top-0 z-10">
              <div className="flex items-center gap-0.5">
                <Button
                  type="button" variant="ghost" size="sm"
                  onMouseDown={keepFocus(undo)}
                  disabled={history.length === 0}
                  className={toolbarBtn}
                  aria-label="Undo"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  onMouseDown={keepFocus(redo)}
                  disabled={future.length === 0}
                  className={toolbarBtn}
                  aria-label="Redo"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  onMouseDown={keepFocus(() => setShowFind((s) => !s))}
                  aria-pressed={showFind}
                  className={cn(toolbarBtn, showFind && "text-white bg-white/[0.08]")}
                  aria-label="Find and replace"
                >
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
              <span className="text-[11px] tabular-nums text-[color:var(--g-text-muted)] pr-1">
                {wordCount}w · {charCount}c
              </span>
            </div>

            {showFind && (
              <div className="border-b border-[color:var(--g-border)] bg-[color:var(--g-surface-3)] p-2 space-y-1.5 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Input
                    value={findTerm}
                    onChange={(e) => setFindTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); findNext(); } }}
                    placeholder="Find"
                    className="h-8 rounded-full bg-[color:var(--g-surface-2)] border-[color:var(--g-border-strong)] text-[13px] px-3 placeholder:text-[color:var(--g-text-muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--g-focus-ring)] focus-visible:ring-offset-0"
                  />
                  <Button type="button" size="sm" variant="ghost"
                    onMouseDown={keepFocus(findNext)}
                    className={toolbarBtn}>
                    Next
                  </Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input
                    value={replaceTerm}
                    onChange={(e) => setReplaceTerm(e.target.value)}
                    placeholder="Replace with"
                    className="h-8 rounded-full bg-[color:var(--g-surface-2)] border-[color:var(--g-border-strong)] text-[13px] px-3 placeholder:text-[color:var(--g-text-muted)] focus-visible:ring-2 focus-visible:ring-[color:var(--g-focus-ring)] focus-visible:ring-offset-0"
                  />
                  <Button type="button" size="sm" variant="ghost"
                    onMouseDown={keepFocus(replaceAll)}
                    className={toolbarBtn}>
                    <ReplaceIcon className="h-3.5 w-3.5 mr-1" /> All
                  </Button>
                </div>
              </div>
            )}

            {/* Scrollable text area fills remaining space */}
            <div className="flex-1 min-h-[120px] overflow-hidden">
              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => updateDraft(e.target.value)}
                onFocus={onTextareaFocus}
                autoFocus
                style={{ fontSize: 16 }}
                className="h-full w-full bg-transparent border-0 rounded-none text-[color:var(--g-text)] placeholder:text-[color:var(--g-text-muted)] leading-relaxed resize-none overflow-y-auto focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-3"
                placeholder="Transcript…"
              />
            </div>

            {/* Sticky footer */}
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-[color:var(--g-border)] bg-[color:var(--g-surface-1)]/95 backdrop-blur shrink-0 sticky bottom-0 z-10">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onMouseDown={keepFocus(discard)}
                disabled={submitting}
                className={toolbarBtn}
              >
                <X className="h-4 w-4 mr-1.5" /> Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={saveDraft}
                disabled={submitting || !draft.trim()}
                className="rounded-full text-white border-0 shadow-[0_6px_20px_-6px_rgba(155,114,203,0.6)] hover:opacity-95 focus-visible:ring-2 focus-visible:ring-[color:var(--g-focus-ring)] focus-visible:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                style={{ background: "var(--g-gradient)" }}
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
        </div>
      )}

    </div>
  );
};


