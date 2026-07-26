import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PasscodeKeypad } from "@/components/auth/PasscodeKeypad";
import { SplashScreen } from "@/components/auth/SplashScreen";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { PasscodeSetupPrompt } from "@/components/auth/PasscodeSetupPrompt";
import { WelcomeBackScreen } from "@/components/auth/WelcomeBackScreen";
import {
  hasPasscode,
  hasOptedOut,
  setOptedOut,
  isUnlocked,
} from "@/lib/passcode";

const SPLASH_KEY = "iv.splash.shown.v1";
const WELCOME_PENDING_KEY = "iv.welcome.pending.v1";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  // Splash only on first mount per tab session.
  const [splashDone, setSplashDone] = useState<boolean>(
    () => sessionStorage.getItem(SPLASH_KEY) === "1"
  );

  const [unlocked, setUnlocked] = useState<boolean>(() => isUnlocked());
  const [wantsSetup, setWantsSetup] = useState(false);
  // Local re-render triggers for passcode state changes.
  const [passcodeVer, setPasscodeVer] = useState(0);

  // 1) Splash
  if (!splashDone) {
    return (
      <SplashScreen
        onDone={() => {
          sessionStorage.setItem(SPLASH_KEY, "1");
          setSplashDone(true);
        }}
      />
    );
  }

  // 2) Loading auth
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground animate-fade-in">
        Loading…
      </div>
    );
  }

  // 3) Auth gate: existing sessions pass through, only signed-out browsers see magic link.
  if (!user) {
    return <AuthScreen />;
  }

  // 4) Signed in, passcode set, not unlocked → unlock keypad
  if (hasPasscode() && !unlocked) {
    return (
      <main className="relative min-h-dvh w-full flex items-center justify-center overflow-hidden text-foreground animate-fade-in">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(900px 600px at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.10) 70%, rgba(0,0,0,0.22) 100%)" }}
        />
        <div className="relative z-10 w-full max-w-md mx-6 px-6 py-10 animate-fade-in">
          <PasscodeKeypad mode="unlock" onUnlocked={() => setUnlocked(true)} />
        </div>
      </main>
    );
  }

  // 5) Signed in, no passcode, hasn't opted out → prompt
  if (!hasPasscode() && !hasOptedOut() && !wantsSetup) {
    return (
      <PasscodeSetupPrompt
        onSetup={() => setWantsSetup(true)}
        onSkip={() => { setOptedOut(); setPasscodeVer((v) => v + 1); }}
      />
    );
  }

  // 5b) Setup flow — pick a passcode
  if (wantsSetup && !hasPasscode()) {
    return (
      <main className="relative min-h-dvh w-full flex items-center justify-center overflow-hidden text-foreground animate-fade-in">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(900px 600px at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.10) 70%, rgba(0,0,0,0.22) 100%)" }}
        />
        <div className="relative z-10 w-full max-w-md mx-6 px-6 py-10 animate-fade-in">
          <PasscodeKeypad
            mode="setup"
            onUnlocked={() => {
              setWantsSetup(false);
              setUnlocked(true);
              setPasscodeVer((v) => v + 1);
            }}
          />
        </div>
      </main>
    );
  }

  return <>{children}</>;
};
