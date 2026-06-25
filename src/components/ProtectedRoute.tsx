import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PasscodeKeypad } from "@/components/auth/PasscodeKeypad";
import { isUnlocked } from "@/lib/passcode";


// Single-user app: anyone who opens the URL is silently signed in as the
// owner — but only after they unlock the local Apple-style passcode gate.
// The passcode never leaves the device.
const AUTO_EMAIL = "admin@trumoveinc.com";
const AUTO_PASSWORD = "Ligma525!";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const attemptedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  // Passcode gate. Re-checked on mount; once unlocked it stays unlocked for
  // the session.
  const [unlocked, setUnlocked] = useState<boolean>(() => isUnlocked());

  useEffect(() => {
    if (!unlocked) return;
    if (loading || user || attemptedRef.current) return;
    attemptedRef.current = true;
    setSigningIn(true);
    (async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: AUTO_EMAIL,
        password: AUTO_PASSWORD,
      });
      if (signInError) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: AUTO_EMAIL,
          password: AUTO_PASSWORD,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (signUpError) setFailed(true);
      }
      setSigningIn(false);
    })();
  }, [loading, user, unlocked]);

  // Gate stays first — show keypad before doing anything cloud-related.
  if (!unlocked) {
    return (
      <main className="relative min-h-dvh w-full flex items-center justify-center overflow-hidden text-white">
        {/* Ambient blurred orbs for glass depth */}
        <div
          aria-hidden
          className="absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full opacity-50 blur-[120px]"
          style={{ background: "radial-gradient(circle, hsl(265 90% 60% / 0.55), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full opacity-40 blur-[140px]"
          style={{ background: "radial-gradient(circle, hsl(210 90% 55% / 0.55), transparent 70%)" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(700px 500px at 50% 40%, transparent, rgba(0,0,0,0.55) 80%)" }}
        />
        <div className="relative z-10 w-full max-w-sm mx-6 px-6 py-10">
          <PasscodeKeypad onUnlocked={() => setUnlocked(true)} />
        </div>

      </main>
    );
  }

  if (!loading && !user && failed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Sign-in failed. Refresh to retry.
      </div>
    );
  }

  if (loading || signingIn || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
};
