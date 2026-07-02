import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isEmailAllowed } from "@/lib/allowlist";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apply = (s: Session | null) => {
      // Enforce single-user allowlist. If a non-allowed user somehow has a
      // session (e.g. stale token, prior signup), sign them out immediately.
      if (s?.user && !isEmailAllowed(s.user.email)) {
        void supabase.auth.signOut();
        setSession(null);
        setUser(null);
        return;
      }
      setSession(s);
      setUser(s?.user ?? null);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      apply(s);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      apply(s);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, user, loading, signOut };
}
