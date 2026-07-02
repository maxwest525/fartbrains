import { Button } from "@/components/ui/button";
import { Lock, Shield } from "lucide-react";

type Props = {
  onSetup: () => void;
  onSkip: () => void;
};

export const PasscodeSetupPrompt = ({ onSetup, onSkip }: Props) => {
  return (
    <main className="relative min-h-dvh w-full flex items-center justify-center overflow-hidden text-foreground animate-fade-in">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(900px 600px at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.30) 100%)" }}
      />
      <div className="relative z-10 w-full max-w-sm mx-6">
        <div className="glass-card-strong rounded-3xl p-7 text-white flex flex-col items-center gap-5">
          <div className="h-14 w-14 rounded-2xl bg-white/[0.08] border border-white/10 flex items-center justify-center">
            <Shield className="h-7 w-7 text-white/90" strokeWidth={1.8} />
          </div>
          <div className="text-center">
            <h1 className="font-display text-[22px] font-semibold tracking-tight">
              Add a passcode?
            </h1>
            <p className="mt-2 text-[13.5px] text-white/65 leading-relaxed">
              Lock IdeaVault behind a 4-digit code on this device.
              It never leaves your phone.
            </p>
          </div>
          <div className="w-full flex flex-col gap-2 mt-1">
            <Button
              onClick={onSetup}
              className="h-13 rounded-2xl brand-gradient text-white text-[15px] font-semibold py-3"
            >
              <Lock className="h-4 w-4 mr-2" /> Set a passcode
            </Button>
            <Button
              variant="ghost"
              onClick={onSkip}
              className="h-12 rounded-2xl text-white/70 hover:text-white"
            >
              Not now
            </Button>
          </div>
          <p className="text-[11.5px] text-white/40 text-center">
            You can add one later from Settings.
          </p>
        </div>
      </div>
    </main>
  );
};
