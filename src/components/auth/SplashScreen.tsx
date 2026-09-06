import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import logo from "@/assets/fartbrains-logo.png";

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
      <div className="relative z-10 flex flex-col items-center gap-4 animate-fade-in">
        <img
          src={logo}
          alt="FartBrains"
          className="w-[min(78vw,420px)] h-auto drop-shadow-[0_0_40px_rgba(96,165,250,0.35)]"
        />
      </div>
    </main>
  );
};
