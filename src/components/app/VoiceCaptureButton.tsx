import { useState } from "react";
import { Mic, Square, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useVoiceCapture, blobToBase64 } from "@/hooks/useVoiceCapture";
import { DELIVERABLE_TYPES, type DeliverableType } from "@/lib/deliverables";

export type VoiceItem = { type: DeliverableType; text: string };

type Props = {
  /** Optional context — improves categorisation and avoids duplicates. */
  projectName?: string;
  existingItems?: string[];
  /** Called once with parsed items after the recording is processed. */
  onItems: (items: VoiceItem[], transcript: string) => void;
  className?: string;
};

const fmtSeconds = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const ALLOWED = DELIVERABLE_TYPES.map((t) => t.key);

/**
 * Compact mic button used inside the project composer + board.
 *
 * Tap once to record, tap again to stop. While recording shows a pulsing dot
 * and the elapsed time. After stop, the audio is sent to the
 * `transcribe-deliverables` edge function, which both transcribes the speech
 * and returns typed deliverables. The parent merges them into its draft list.
 */
export const VoiceCaptureButton = ({
  projectName,
  existingItems,
  onItems,
  className,
}: Props) => {
  const voice = useVoiceCapture({ maxSeconds: 120 });
  const [submitting, setSubmitting] = useState(false);

  const isRecording = voice.state === "recording";
  const isBusy = voice.state === "requesting" || voice.state === "processing" || submitting;

  const handleClick = async () => {
    try {
      if (voice.state === "idle") {
        await voice.start();
        return;
      }
      if (voice.state === "recording") {
        const { blob, mimeType } = await voice.stop();
        if (blob.size < 800) {
          toast.error("That was too short — hold the mic a bit longer.");
          voice.finishProcessing();
          return;
        }
        setSubmitting(true);
        const audioBase64 = await blobToBase64(blob);
        const { data, error } = await supabase.functions.invoke(
          "transcribe-deliverables",
          {
            body: {
              audioBase64,
              mimeType,
              allowedTypes: ALLOWED,
              projectName,
              existingItems,
            },
          }
        );
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        const items: VoiceItem[] = Array.isArray(data?.items) ? data.items : [];
        const transcript: string = typeof data?.transcript === "string" ? data.transcript : "";

        if (items.length === 0) {
          toast.message("Nothing to add", {
            description: transcript
              ? `Heard: "${transcript.slice(0, 80)}"`
              : "I couldn't pull any deliverables from that — try again.",
          });
        } else {
          onItems(items, transcript);
          toast.success(`Added ${items.length} item${items.length === 1 ? "" : "s"} from voice`);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Voice capture failed");
    } finally {
      setSubmitting(false);
      voice.finishProcessing();
    }
  };

  const cancel = () => {
    voice.cancel();
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        onClick={handleClick}
        disabled={isBusy && !isRecording}
        variant={isRecording ? "destructive" : "outline"}
        className={cn(
          "h-11 rounded-xl px-3 gap-1.5 font-medium",
          isRecording && "animate-pulse"
        )}
        aria-label={isRecording ? "Stop recording" : "Record voice"}
      >
        {voice.state === "requesting" || voice.state === "processing" || submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <>
            <Square className="h-4 w-4 fill-current" />
            <span className="tabular-nums text-[13px]">{fmtSeconds(voice.seconds)}</span>
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" />
            <span className="text-[13px]">Speak</span>
          </>
        )}
      </Button>
      {isRecording && (
        <button
          type="button"
          onClick={cancel}
          className="press h-11 w-11 inline-flex items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground hover:text-foreground"
          aria-label="Cancel recording"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
