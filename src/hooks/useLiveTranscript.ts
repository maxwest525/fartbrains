import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the Web Speech API — not in lib.dom by default.
type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
type SR = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SRCtor = new () => SR;

const getCtor = (): SRCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * Runs the browser's SpeechRecognition alongside MediaRecorder to surface a
 * live partial transcript while the user is recording. The server-side
 * transcription remains authoritative on stop — this is preview only.
 */
export const useLiveTranscript = () => {
  const supported = typeof window !== "undefined" && !!getCtor();
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const recRef = useRef<SR | null>(null);
  const activeRef = useRef(false);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    // Stop any prior instance defensively.
    recRef.current?.abort();
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      let interimBuf = "";
      let finalBuf = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) finalBuf += t;
        else interimBuf += t;
      }
      if (finalBuf) setFinalText((prev) => (prev ? prev + " " : "") + finalBuf.trim());
      setInterim(interimBuf.trim());
    };
    rec.onerror = () => { /* ignore — server transcript is source of truth */ };
    rec.onend = () => {
      // Chrome stops after silence — auto-restart while user is still recording.
      if (activeRef.current) {
        try { rec.start(); } catch { /* ignore */ }
      }
    };
    setFinalText("");
    setInterim("");
    activeRef.current = true;
    try { rec.start(); } catch { /* ignore */ }
    recRef.current = rec;
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    try { recRef.current?.stop(); } catch { /* ignore */ }
    recRef.current = null;
  }, []);

  const reset = useCallback(() => {
    setFinalText("");
    setInterim("");
  }, []);

  useEffect(() => () => {
    activeRef.current = false;
    try { recRef.current?.abort(); } catch { /* ignore */ }
  }, []);

  const combined = [finalText, interim].filter(Boolean).join(" ").trim();
  return { supported, start, stop, reset, finalText, interim, text: combined };
};
