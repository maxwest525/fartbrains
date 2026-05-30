import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// Single-user app: anyone who opens the URL is silently signed in as the
// owner. No login screen, no password prompt. Credentials are intentionally
// embedded — this app is meant to be shared (including with other AIs)
// without exposing the underlying account flow.
const AUTO_EMAIL = "admin@trumoveinc.com";
const AUTO_PASSWORD = "Ligma525!";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  // One-shot guard: if auto sign-in fails we must NOT loop. The previous
  // version flipped `signingIn` back to false, which re-triggered the effect
  // and hammered Supabase /token + /signup endlessly, freezing the app on
  // "Loading…".
  const attemptedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loading || user || attemptedRef.current) return;
    attemptedRef.current = true;
    setSigningIn(true);
    (async () => {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: AUTO_EMAIL,
        password: AUTO_PASSWORD,
      });
      if (signInError) {
        // Account doesn't exist yet — create it. If that also fails (e.g.
        // signups disabled, user exists with different password), stop trying
        // and fall back to the manual auth screen.
        const { error: signUpError } = await supabase.auth.signUp({
          email: AUTO_EMAIL,
          password: AUTO_PASSWORD,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (signUpError) setFailed(true);
      }
      setSigningIn(false);
    })();
  }, [loading, user]);

  if (!loading && !user && failed) {
    return <Navigate to="/auth" replace />;
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
