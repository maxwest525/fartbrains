import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = { onDone: () => void; duration?: number };

export const SplashScreen = ({ onDone, duration = 1500 }: Props) => {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), duration - 300);
    const t2 = setTimeout(onDone, duration);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration, onDone]);

  return (
    <main
      className={cn(
        "relative min-h-dvh w-full flex items-center justify-center overflow-hidden text-foreground transition-opacity duration-300",
        leaving ? "opacity-0" : "opacity-100"
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(900px 600px at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.30) 100%)" }}
      />
      <div className="relative z-10 flex flex-col items-center gap-5 animate-fade-in">
        <div className="relative h-24 w-24 rounded-[28px] brand-gradient ring-glow flex items-center justify-center shadow-2xl">
          <span className="font-display text-[42px] font-bold text-white drop-shadow">IV</span>
          <span aria-hidden className="absolute inset-0 rounded-[28px] bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
        </div>
        <div className="font-display text-[26px] font-semibold tracking-tight text-white/95">
          Idea<span className="brand-gradient-text">Vault</span>
        </div>
      </div>
    </main>
  );
};
