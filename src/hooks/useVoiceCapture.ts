import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "requesting" | "recording" | "processing";

type Options = {
  /** Hard cap so users can't accidentally upload a 10-minute clip. */
  maxSeconds?: number;
};

/**
 * Mic-driven audio capture using the browser's MediaRecorder. Returns a small
 * controller the UI can drive: start, stop (resolves with the blob+mime), and
 * cancel. Tracks recording duration for the live indicator.
 */
export const useVoiceCapture = ({ maxSeconds = 120 }: Options = {}) => {
  const [state, setState] = useState<VoiceState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const stopResolveRef = useRef<((value: { blob: Blob; mimeType: string }) => void) | null>(null);
  const stopRejectRef = useRef<((reason: unknown) => void) | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    recorderRef.current = null;
    chunksRef.current = [];
    setSeconds(0);
  }, []);

  // Make sure we release the mic if the component unmounts mid-recording.
  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    if (state !== "idle") return;
    setError(null);
    setState("requesting");
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = micStream;
      setStream(micStream);

      // Pick the best mime the browser supports. Safari prefers mp4.
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
      const mimeType =
        candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const recorder = mimeType
        ? new MediaRecorder(micStream, { mimeType })
        : new MediaRecorder(micStream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = (e) => {
        const err = (e as unknown as { error?: Error }).error ?? new Error("Recorder error");
        stopRejectRef.current?.(err);
        stopResolveRef.current = null;
        stopRejectRef.current = null;
        cleanup();
        setState("idle");
        setError(err.message);
      };
      recorder.onstop = () => {
        const finalMime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: finalMime });
        stopResolveRef.current?.({ blob, mimeType: finalMime });
        stopResolveRef.current = null;
        stopRejectRef.current = null;
        cleanup();
        // Caller flips state to "processing" before awaiting; we leave it
        // there until they finish their post-stop work.
      };

      recorder.start();
      recorderRef.current = recorder;
      setState("recording");
      setSeconds(0);
      tickRef.current = window.setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= maxSeconds && recorderRef.current?.state === "recording") {
            // Auto-stop at the cap. The pending stop() promise (if any) resolves.
            recorderRef.current.stop();
          }
          return next;
        });
      }, 1000);
    } catch (e) {
      cleanup();
      setState("idle");
      const msg =
        e instanceof Error
          ? e.name === "NotAllowedError"
            ? "Microphone permission denied."
            : e.message
          : "Couldn't access the microphone.";
      setError(msg);
      throw new Error(msg);
    }
  }, [state, maxSeconds, cleanup]);

  /** Stop recording and resolve with the captured blob. */
  const stop = useCallback(async (): Promise<{ blob: Blob; mimeType: string }> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      throw new Error("No active recording");
    }
    setState("processing");
    return new Promise((resolve, reject) => {
      stopResolveRef.current = resolve;
      stopRejectRef.current = reject;
      recorder.stop();
    });
  }, []);

  /** Discard the current recording without producing a blob. */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      // Suppress the onstop resolver — caller doesn't want the blob.
      stopResolveRef.current = null;
      stopRejectRef.current = null;
      recorder.onstop = () => {
        cleanup();
      };
      recorder.stop();
    } else {
      cleanup();
    }
    setState("idle");
  }, [cleanup]);

  /** Mark async post-processing as complete so the indicator resets. */
  const finishProcessing = useCallback(() => {
    setState("idle");
  }, []);

  return { state, seconds, error, stream, start, stop, cancel, finishProcessing };
};

/** Convert an audio Blob to base64 (no data: prefix). */
export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.onload = () => {
      const result = reader.result as string;
      // result looks like: "data:audio/webm;base64,XXXX"
      const idx = result.indexOf("base64,");
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.readAsDataURL(blob);
  });
