import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/fartbrains-logo.png";

const LINES = [
  { pre: "Welcome", accent: "back." },
  { pre: "We", accent: "missed you." },
  { pre: "You probably just don't", accent: "remember." },
];

type Props = { onDone: () => void };

/**
 * One-time cheeky welcome shown to brand-new accounts. Cycles three lines
 * then reveals a "Let's go" button.
 */
export const WelcomeBackScreen = ({ onDone }: Props) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= LINES.length - 1) return;
    const id = window.setTimeout(() => setStep((s) => s + 1), 1400);
    return () => window.clearTimeout(id);
  }, [step]);

  const line = LINES[step];

  return (
    <main className="relative min-h-dvh w-full flex items-center justify-center overflow-hidden text-foreground animate-fade-in">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(900px 600px at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.30) 100%)",
        }}
      />
      <div className="relative z-10 w-full max-w-sm mx-6 text-center">
        <div className="glass-card-strong rounded-3xl p-8 text-white flex flex-col items-center gap-6">
          <img
            src={logo}
            alt="FartBrains"
            className="w-32 h-auto drop-shadow-[0_0_30px_rgba(96,165,250,0.35)]"
          />
          <div key={step} className="min-h-[88px] flex flex-col items-center justify-center animate-fade-in">
            <p className="font-display text-[26px] leading-tight font-semibold tracking-tight text-[#f8fafc]">
              {line.pre}{" "}
              <span className="bg-gradient-to-r from-[#F2A4AC] via-[#9B72CB] to-[#4285F4] bg-clip-text text-transparent">
                {line.accent}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {LINES.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-white" : "w-1.5 bg-white/30"
                }`}
              />
            ))}
          </div>

          {step >= LINES.length - 1 ? (
            <Button
              onClick={onDone}
              className="h-12 rounded-2xl brand-gradient text-white text-[15px] font-semibold px-8 animate-fade-in"
            >
              Let's go
            </Button>
          ) : (
            <button
              type="button"
              onClick={onDone}
              className="text-[12px] text-white/50 hover:text-white/80"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </main>
  );
};
