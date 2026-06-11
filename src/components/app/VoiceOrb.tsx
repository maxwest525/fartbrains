import { useEffect, useState } from "react";
import { Mic, Square, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceCapture, blobToBase64 } from "@/hooks/useVoiceCapture";
import { useCreateIdea } from "@/hooks/useIdeas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const FOLDER_KEY = "ash-dock-folder-v1";

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

/**
 * Big voice-to-text orb — single tap starts recording, tap again to stop.
 * After transcription, shows an editable preview so the user can tweak the
 * text before committing it as a new idea. Always dark themed.
 */
export const VoiceOrb = () => {
  const voice = useVoiceCapture({ maxSeconds: 180 });
  const createIdea = useCreateIdea();
  const [submitting, setSubmitting] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    try { setFolderId(localStorage.getItem(FOLDER_KEY)); } catch { /* ignore */ }
    const onStorage = (e: StorageEvent) => {
      if (e.key === FOLDER_KEY) setFolderId(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isRecording = voice.state === "recording";
  const isTranscribing = voice.state === "requesting" || voice.state === "processing";
  const isBusy = isTranscribing || submitting;

  const onTap = async () => {
    try {
      if (draft !== null) return; // editor open — ignore taps
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
        setDraft(transcript.trim());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice capture failed");
    } finally {
      voice.finishProcessing();
    }
  };

  const saveDraft = async () => {
    if (!draft || !draft.trim()) return;
    setSubmitting(true);
    try {
      await createIdea.mutateAsync({
        title: titleFromText(draft),
        raw_note: draft.trim(),
        source_type: "audio",
        folder_id: folderId,
      });
      toast.success("Idea saved");
      setDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const status = isRecording
    ? `Listening · ${fmtSeconds(voice.seconds)}`
    : isTranscribing
      ? "Transcribing…"
      : draft !== null
        ? "Review & edit"
        : "Tap to speak";

  return (
    <div className="dark relative flex flex-col items-center justify-center gap-6 py-8 px-4 sm:px-6 rounded-3xl bg-[hsl(222_18%_8%)] text-[hsl(220_14%_96%)] overflow-hidden">
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
        disabled={isBusy || draft !== null}
        aria-label={isRecording ? "Stop recording" : "Start voice capture"}
        className={cn(
          "relative h-36 w-36 sm:h-44 sm:w-44 rounded-full flex items-center justify-center select-none transition-transform active:scale-[0.97]",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40",
          (isBusy || draft !== null) && "opacity-80",
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
          className="absolute left-1/2 top-3 h-10 w-24 -translate-x-1/2 rounded-full bg-white/25 blur-md"
        />

        <span className="relative z-10 text-white">
          {isTranscribing ? (
            <Loader2 className="h-10 w-10 animate-spin" />
          ) : isRecording ? (
            <Square className="h-10 w-10 fill-current" />
          ) : (
            <Mic className="h-12 w-12" strokeWidth={2.2} />
          )}
        </span>
      </button>

      <div className="relative text-center space-y-1">
        <p className="text-[15px] font-medium tracking-tight">{status}</p>
        {draft === null && (
          <p className="text-[12.5px] text-[hsl(220_9%_65%)]">
            Speak your idea — edit before saving.
          </p>
        )}
      </div>

      {draft !== null && (
        <div className="relative w-full max-w-lg space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            rows={6}
            className="bg-[hsl(222_14%_12%)] border-[hsl(222_14%_22%)] text-[hsl(220_14%_96%)] placeholder:text-[hsl(220_9%_55%)] text-[14px] leading-relaxed resize-none"
            placeholder="Transcript…"
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraft(null)}
              disabled={submitting}
              className="text-[hsl(220_9%_75%)] hover:text-white hover:bg-white/5"
            >
              <X className="h-4 w-4 mr-1.5" /> Discard
            </Button>
            <Button
              type="button"
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
