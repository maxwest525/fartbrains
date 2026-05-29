import { useEffect, useRef, useState } from "react";
import { AlarmClock, X } from "lucide-react";
import { alarmBus, type AlarmPayload } from "@/lib/alarmBus";
import { Button } from "@/components/ui/button";

/**
 * Full-screen, attention-grabbing alarm that fires when a reminder is
 * due while the site is open. Plays a loud, looping two-tone siren
 * (Web Audio API — generated, not the actual EAS tones) until the user
 * taps Dismiss. Also pulses the screen and vibrates on supported devices.
 *
 * The siren alternates two square-wave tones rapidly to mimic the
 * "attention" feel of an emergency alert without being a clone of the
 * SAME/EAS signal. Volume is pushed to the system max the browser
 * allows; the user's device volume still applies.
 */
export const AlarmOverlay = () => {
  const [active, setActive] = useState(false);
  const [payload, setPayload] = useState<AlarmPayload | null>(null);
  const audioRef = useRef<{
    ctx: AudioContext;
    gain: GainNode;
    oscA: OscillatorNode;
    oscB: OscillatorNode;
    interval: number;
  } | null>(null);
  const vibrateRef = useRef<number | null>(null);

  // Subscribe to bus
  useEffect(() => {
    return alarmBus.subscribe((p) => {
      setPayload(p);
      setActive(true);
    });
  }, []);

  // Start / stop siren when active changes
  useEffect(() => {
    if (!active) return;

    let stopped = false;
    const start = () => {
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AC();
        // Resume — autoplay policies require this after a user gesture.
        // The reminder fires after the user already interacted (they're
        // using the app), but if blocked we'll fall back to the visual
        // overlay alone.
        ctx.resume().catch(() => {});

        const gain = ctx.createGain();
        gain.gain.value = 0.0001;
        gain.connect(ctx.destination);

        // Two tones — alternated to create a "warble" siren.
        const oscA = ctx.createOscillator();
        oscA.type = "square";
        oscA.frequency.value = 880;
        const oscB = ctx.createOscillator();
        oscB.type = "square";
        oscB.frequency.value = 1175;

        // Subtle detune to thicken
        const oscC = ctx.createOscillator();
        oscC.type = "sawtooth";
        oscC.frequency.value = 440;

        oscA.connect(gain);
        oscB.connect(gain);
        oscC.connect(gain);

        oscA.start();
        oscB.start();
        oscC.start();

        // Ramp to loud
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.05);

        // Alternate frequencies to create the attention-tone warble
        let flip = false;
        const interval = window.setInterval(() => {
          if (stopped) return;
          flip = !flip;
          const now = ctx.currentTime;
          oscA.frequency.setValueAtTime(flip ? 880 : 988, now);
          oscB.frequency.setValueAtTime(flip ? 1175 : 1318, now);
          oscC.frequency.setValueAtTime(flip ? 440 : 494, now);
        }, 380);

        audioRef.current = { ctx, gain, oscA, oscB, interval };
      } catch {
        /* audio unsupported — visual alarm only */
      }
    };

    start();

    // Vibration (Android Chrome only; iOS Safari ignores)
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
        vibrateRef.current = window.setInterval(() => {
          navigator.vibrate?.([400, 200, 400, 200, 400, 200, 400]);
        }, 2200);
      } catch {
        /* noop */
      }
    }

    return () => {
      stopped = true;
      const a = audioRef.current;
      if (a) {
        try {
          window.clearInterval(a.interval);
          a.gain.gain.cancelScheduledValues(a.ctx.currentTime);
          a.gain.gain.exponentialRampToValueAtTime(
            0.0001,
            a.ctx.currentTime + 0.05,
          );
          window.setTimeout(() => {
            try {
              a.oscA.stop();
              a.oscB.stop();
              a.ctx.close();
            } catch {
              /* noop */
            }
          }, 80);
        } catch {
          /* noop */
        }
        audioRef.current = null;
      }
      if (vibrateRef.current) {
        window.clearInterval(vibrateRef.current);
        vibrateRef.current = null;
      }
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate(0);
        } catch {
          /* noop */
        }
      }
    };
  }, [active]);

  if (!active || !payload) return null;

  return (
    <div
      role="alertdialog"
      aria-label="Reminder alarm"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center text-center px-6 animate-alarm-pulse"
      style={{
        background:
          "radial-gradient(ellipse at center, hsl(0 90% 35%) 0%, hsl(0 100% 18%) 70%, hsl(0 100% 8%) 100%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-60 animate-alarm-strobe" />

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md">
        <div className="h-24 w-24 rounded-full bg-white/15 backdrop-blur flex items-center justify-center ring-4 ring-white/30 animate-alarm-ring">
          <AlarmClock className="h-12 w-12 text-white" strokeWidth={2.2} />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] tracking-[0.3em] font-semibold text-white/80 uppercase">
            ⚠ Reminder Alert
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight break-words">
            {payload.title}
          </h2>
          {payload.body && (
            <p className="text-base text-white/85">{payload.body}</p>
          )}
        </div>

        <Button
          size="lg"
          onClick={() => {
            setActive(false);
            setPayload(null);
          }}
          className="mt-4 h-14 px-10 rounded-full bg-white text-red-700 hover:bg-white/90 font-bold text-lg shadow-2xl"
        >
          <X className="h-5 w-5 mr-2" /> Tap to dismiss
        </Button>

        <p className="text-xs text-white/70">
          Sound will keep looping until dismissed.
        </p>
      </div>
    </div>
  );
};
