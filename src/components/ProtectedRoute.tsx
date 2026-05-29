import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (loading || user || signingIn) return;
    setSigningIn(true);
    (async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: AUTO_EMAIL,
        password: AUTO_PASSWORD,
      });
      if (error) {
        // Account doesn't exist yet — create it, then it auto-signs in.
        await supabase.auth.signUp({
          email: AUTO_EMAIL,
          password: AUTO_PASSWORD,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
      }
      setSigningIn(false);
    })();
  }, [loading, user, signingIn]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
};
