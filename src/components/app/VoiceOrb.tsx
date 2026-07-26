import { useEffect, useState } from "react";
import { Mic, Square, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import { cn } from "@/lib/utils";
import { useVoiceCapture, blobToBase64 } from "@/hooks/useVoiceCapture";
import { useCreateIdea } from "@/hooks/useIdeas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LiveWaveform } from "@/components/app/LiveWaveform";
import { useLiveTranscript } from "@/hooks/useLiveTranscript";

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

type VoiceOrbProps = {
  /** True while Ash is speaking back — animates the orb in a different color. */
  speaking?: boolean;
};


export const VoiceOrb = ({ speaking = false }: VoiceOrbProps) => {
  const voice = useVoiceCapture({ maxSeconds: 180 });
  const live = useLiveTranscript();
  const createIdea = useCreateIdea();
  const [submitting, setSubmitting] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);

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

  // Do NOT collapse the Ash composer while recording — the transcript is
  // routed into it, so the user needs to see it. Keep dock at normal size.
  useEffect(() => {
    document.body.dataset.voiceWorkspaceOpen = "false";
    window.dispatchEvent(new CustomEvent("idea-vault:voice-workspace", { detail: false }));
  }, []);

  const onTap = async () => {
    // Idle → start recording. Handled outside the try/finally below so we
    // don't accidentally reset the "recording" state via finishProcessing().
    if (voice.state === "idle") {
      try {
        await voice.start();
        setMicPerm("granted");
        // Kick off live browser-side partial transcription so the user can see
        // what is being captured. The saved server transcript remains final.
        if (live.supported) live.start();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Couldn't start the mic.";
        const denied = /denied|NotAllowed/i.test(msg);
        if (denied) {
          setMicPerm("denied");
          const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
          toast.error(
            isIOS
              ? "Mic blocked. Open Settings → Safari → Microphone and allow it for this site, then reload."
              : "Mic blocked. Click the lock icon in the address bar → allow Microphone, then reload."
          );
        } else {
          toast.error(msg);
        }
      }
      return;
    }

    try {
      if (voice.state === "recording") {
        live.stop();
        const { blob, mimeType } = await voice.stop();
        if (blob.size < 800) {
          toast.error("Too short — hold a bit longer.");
          voice.finishProcessing();
          live.reset();
          return;
        }

        setSubmitting(true);
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) throw new Error("Sign in to save voice prompts");
        const ext = mimeType.includes("mp4") ? "mp4"
          : mimeType.includes("webm") ? "webm"
          : mimeType.includes("mpeg") ? "mp3"
          : mimeType.includes("wav") ? "wav"
          : "webm";
        const path = `${uid}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("idea-audio")
          .upload(path, blob, { contentType: mimeType, upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("idea-audio").getPublicUrl(path);
        const seconds = voice.seconds;

        let transcript = "";
        const audioBase64 = await blobToBase64(blob);
        const { data: tr, error: trErr } = await supabase.functions.invoke("transcribe-deliverables", {
          body: { audioBase64, mimeType, allowedTypes: ["other"] },
        });
        if (trErr) throw new Error(trErr.message);
        if (tr?.error) throw new Error(tr.error);
        transcript = typeof tr?.transcript === "string" ? tr.transcript.trim() : "";

        await createIdea.mutateAsync({
          title: transcript ? titleFromText(transcript).slice(0, 200) : `Voice prompt · ${fmtSeconds(seconds)}`,
          raw_note: transcript || null,
          extracted_text: transcript || null,
          source_type: "audio",
          source_url: pub.publicUrl,
          source_label: "Voice prompt",
          source_meta: { audio: { url: pub.publicUrl, mimeType, durationSeconds: seconds } },
          folder_id: folderId,
        });
        toast.success(transcript ? "Voice prompt saved with transcript" : "Voice prompt saved");
        return;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice capture failed");
    } finally {
      voice.finishProcessing();
      live.reset();
      setSubmitting(false);
    }
  };

  const status = isRecording
    ? `Listening · ${fmtSeconds(voice.seconds)}`
    : isTranscribing
      ? "Saving…"
      : speaking
        ? "Ash is speaking…"
        : "Tap for voice prompt";

  const permMeta = micPerm === "granted"
    ? { Icon: ShieldCheck, label: "Mic ready", tone: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30" }
    : micPerm === "denied"
      ? { Icon: ShieldAlert, label: "Mic blocked", tone: "text-red-300 bg-red-400/10 border-red-400/40" }
      : micPerm === "prompt"
        ? { Icon: ShieldQuestion, label: "Mic permission needed", tone: "text-amber-200 bg-amber-400/10 border-amber-400/30" }
        : { Icon: ShieldQuestion, label: "Tap to allow mic", tone: "text-white/60 bg-white/[0.04] border-white/10" };

  return (
    <div className="gemini dark relative flex flex-col items-center justify-center gap-5 sm:gap-6 py-6 sm:py-8 px-3 sm:px-6 text-[color:var(--g-text)] w-full">
      {/* No full-screen background — let the global aurora show through */}


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

      <div className="relative text-center">
        <p className="text-[14px] sm:text-[15px] font-medium tracking-tight leading-tight">{status}</p>
      </div>

      {/* Live recording indicator: waveform + timer. Visible during recording
          so the user gets immediate feedback that audio is being captured. */}
      {(isRecording || isTranscribing) && (
        <div
          role="status"
          aria-live="polite"
          aria-label={isRecording ? `Recording, ${fmtSeconds(voice.seconds)}` : "Transcribing"}
          className="w-full max-w-xs flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0",
              isRecording ? "bg-[color:var(--g-red)] animate-pulse" : "bg-white/40",
            )}
          />
          <LiveWaveform
            stream={voice.stream}
            active={isRecording}
            className="flex-1 h-9"
          />
          <span className="text-[12.5px] tabular-nums font-medium text-white/85 shrink-0">
            {fmtSeconds(voice.seconds)}
          </span>
        </div>
      )}

      {/* Live partial transcript — updates in real time while recording.
          Server transcription remains authoritative on stop.
          Auto-scrolls into view so the bottom composer (AshDock) never covers it. */}
      {(isRecording || isTranscribing) && live.supported && (
        <div
          ref={(el) => {
            if (el) {
              requestAnimationFrame(() =>
                el.scrollIntoView({ behavior: "smooth", block: "center" })
              );
            }
          }}
          aria-live="polite"
          className="w-full max-w-md min-h-[3.25rem] max-h-40 overflow-y-auto px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md text-[13.5px] leading-relaxed text-white/90"
        >
          {live.finalText && <span>{live.finalText} </span>}
          {live.interim && <span className="text-white/55 italic">{live.interim}</span>}
          {!live.finalText && !live.interim && (
            <span className="text-white/40 italic">Listening for speech…</span>
          )}
        </div>
      )}

    </div>
  );
};


