import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Live mic stream. When null, the bars idle at a low baseline. */
  stream: MediaStream | null;
  /** Active recording state — drives whether we animate at all. */
  active: boolean;
  /** Number of bars to render. */
  bars?: number;
  className?: string;
};

/**
 * Real-time audio level meter drawn on a canvas. Reads the mic input through
 * a Web Audio AnalyserNode and renders a symmetric bar meter that reacts to
 * the user's voice — gives immediate feedback that recording is capturing.
 */
export const LiveWaveform = ({ stream, active, bars = 28, className }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c2d = canvas.getContext("2d");
    if (!c2d) return;

    let smoothed = new Array(bars).fill(0);

    const teardown = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try { sourceRef.current?.disconnect(); } catch { /* ignore */ }
      try { analyserRef.current?.disconnect(); } catch { /* ignore */ }
      try { ctxRef.current?.close(); } catch { /* ignore */ }
      sourceRef.current = null;
      analyserRef.current = null;
      ctxRef.current = null;
    };

    // Only wire up the analyser when we actually have a live stream.
    if (stream && active) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AC();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.6;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      ctxRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    }

    const buffer = new Uint8Array(256);

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
      }
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      c2d.clearRect(0, 0, cssW, cssH);

      const analyser = analyserRef.current;
      const levels = new Array(bars).fill(0);
      if (analyser && active) {
        analyser.getByteFrequencyData(buffer);
        // Sample `bars` slices across the low-mid range (voice sits here).
        const usable = Math.min(buffer.length, 160);
        const slice = Math.max(1, Math.floor(usable / bars));
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < slice; j++) sum += buffer[i * slice + j] ?? 0;
          levels[i] = sum / slice / 255; // 0..1
        }
      } else {
        // Idle: gentle sine baseline so the meter doesn't look dead.
        const t = performance.now() / 500;
        for (let i = 0; i < bars; i++) {
          levels[i] = 0.06 + 0.04 * Math.sin(t + i * 0.35);
        }
      }

      const gap = 3;
      const barW = Math.max(2, (cssW - gap * (bars - 1)) / bars);
      const mid = cssH / 2;

      for (let i = 0; i < bars; i++) {
        // Ease + smooth so bars don't flicker.
        const target = Math.pow(levels[i], 0.75);
        smoothed[i] = smoothed[i] * 0.55 + target * 0.45;
        const h = Math.max(2, smoothed[i] * (cssH - 4));
        const x = i * (barW + gap);
        const y = mid - h / 2;
        // Warm gradient — red when hot, soft when quiet — matches record state.
        const hot = smoothed[i];
        const r = Math.round(217 + (242 - 217) * hot);
        const g = Math.round(101 - 40 * hot);
        const b = Math.round(112 - 40 * hot);
        c2d.fillStyle = `rgb(${r},${g},${b})`;
        c2d.beginPath();
        const radius = Math.min(barW / 2, 4);
        // Rounded pill per bar.
        const x2 = x + barW;
        const y2 = y + h;
        c2d.moveTo(x + radius, y);
        c2d.lineTo(x2 - radius, y);
        c2d.quadraticCurveTo(x2, y, x2, y + radius);
        c2d.lineTo(x2, y2 - radius);
        c2d.quadraticCurveTo(x2, y2, x2 - radius, y2);
        c2d.lineTo(x + radius, y2);
        c2d.quadraticCurveTo(x, y2, x, y2 - radius);
        c2d.lineTo(x, y + radius);
        c2d.quadraticCurveTo(x, y, x + radius, y);
        c2d.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return teardown;
  }, [stream, active, bars]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("block w-full h-10", className)}
    />
  );
};
