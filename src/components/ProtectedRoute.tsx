import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PasscodeKeypad } from "@/components/auth/PasscodeKeypad";
import { SplashScreen } from "@/components/auth/SplashScreen";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { WelcomeBackScreen } from "@/components/auth/WelcomeBackScreen";
import { hasPasscode, isUnlocked, lock } from "@/lib/passcode";

const SPLASH_KEY = "iv.splash.shown.v1";
const WELCOME_PENDING_KEY = "iv.welcome.pending.v1";

/**
 * Gate for every authenticated surface.
 *
 * Order: splash -> auth loading -> sign in -> one-time welcome -> optional
 * app lock -> app.
 *
 * App lock (the local passcode) is deliberately NOT part of first run. It is an
 * opt-in device-level convenience configured under Settings -> Privacy &
 * security, so a brand-new customer reaches their brain immediately.
 */
export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  // Splash only on first mount per tab session.
  const [splashDone, setSplashDone] = useState<boolean>(
    () => sessionStorage.getItem(SPLASH_KEY) === "1"
  );

  const [unlocked, setUnlocked] = useState<boolean>(() => isUnlocked());

  // One-time welcome shown to freshly signed-up accounts. The flag is set on
  // signUp success in AuthScreen and cleared after the user dismisses it.
  const [welcomePending, setWelcomePending] = useState<boolean>(
    () => localStorage.getItem(WELCOME_PENDING_KEY) === "1"
  );
  const dismissWelcome = () => {
    try { localStorage.removeItem(WELCOME_PENDING_KEY); } catch { /* ignore */ }
    setWelcomePending(false);
  };

  // Signing out must re-arm the app lock, otherwise the next account on this
  // device inherits an unlocked session.
  useEffect(() => {
    if (!loading && !user) {
      lock();
      setUnlocked(false);
    }
  }, [loading, user]);

  // Keep the welcome flag in sync if a signup completes while mounted.
  useEffect(() => {
    if (user && localStorage.getItem(WELCOME_PENDING_KEY) === "1") {
      setWelcomePending(true);
    }
  }, [user]);

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

  // 3) Not signed in → real auth gate. No anonymous fallback session: an
  //    anonymous JWT is still a JWT, and it would let unauthenticated traffic
  //    spend the account's AI budget through the edge functions.
  if (!user) {
    return <AuthScreen />;
  }

  // 4) Brand-new account? Show the welcome once.
  if (welcomePending) {
    return <WelcomeBackScreen onDone={dismissWelcome} />;
  }

  // 5) Optional app lock configured on this device → unlock keypad
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

  return <>{children}</>;
};
