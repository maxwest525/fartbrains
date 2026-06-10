import { useEffect, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceCapture, blobToBase64 } from "@/hooks/useVoiceCapture";
import { useCreateIdea } from "@/hooks/useIdeas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
 * Big voice-to-text orb — single tap starts recording, tap again to stop and save.
 * Always dark-themed regardless of app theme. Used as the primary action on the
 * Capture screen now that the bottom AshDock handles text input.
 */
export const VoiceOrb = () => {
  const voice = useVoiceCapture({ maxSeconds: 180 });
  const createIdea = useCreateIdea();
  const [submitting, setSubmitting] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);

  // Mirror AshDock's folder pick so the orb saves to the same place.
  useEffect(() => {
    try { setFolderId(localStorage.getItem(FOLDER_KEY)); } catch { /* ignore */ }
    const onStorage = (e: StorageEvent) => {
      if (e.key === FOLDER_KEY) setFolderId(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isRecording = voice.state === "recording";
  const isBusy = voice.state === "requesting" || voice.state === "processing" || submitting;

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
        setSubmitting(true);
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
        toast.success("Idea saved from voice");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice capture failed");
    } finally {
      setSubmitting(false);
      voice.finishProcessing();
    }
  };

  const status = isRecording
    ? `Listening · ${fmtSeconds(voice.seconds)}`
    : isBusy
      ? "Transcribing…"
      : "Tap to speak";

  return (
    <div className="dark relative flex flex-col items-center justify-center gap-8 py-10 px-6 rounded-3xl bg-[hsl(222_18%_8%)] text-[hsl(220_14%_96%)] overflow-hidden">
      {/* Ambient glow */}
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
        disabled={isBusy && !isRecording}
        aria-label={isRecording ? "Stop recording" : "Start voice capture"}
        className={cn(
          "relative h-44 w-44 rounded-full flex items-center justify-center select-none transition-transform active:scale-[0.97]",
          "focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/40",
        )}
      >
        {/* Pulse rings while recording */}
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
            <span className="absolute -inset-3 rounded-full bg-primary/10 animate-pulse" />
          </>
        )}

        {/* Orb body */}
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
        {/* Glossy highlight */}
        <span
          aria-hidden
          className="absolute left-1/2 top-3 h-10 w-24 -translate-x-1/2 rounded-full bg-white/25 blur-md"
        />

        <span className="relative z-10 text-white">
          {isBusy && !isRecording ? (
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
        <p className="text-[12.5px] text-[hsl(220_9%_65%)]">
          Speak your idea — it'll save automatically.
        </p>
      </div>
    </div>
  );
};
