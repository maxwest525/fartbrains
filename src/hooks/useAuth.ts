import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Anonymous Supabase sessions are never a signed-in customer. The app used to
 * mint them for every visitor, which handed unauthenticated traffic a valid JWT
 * (and therefore access to paid AI edge functions). Treat them as signed-out and
 * clear them so no stale anonymous token lingers in local storage.
 */
export function isAnonymousSession(session: Session | null): boolean {
  const u = session?.user as (User & { is_anonymous?: boolean }) | undefined;
  if (!u) return false;
  return u.is_anonymous === true;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apply = (s: Session | null) => {
      if (isAnonymousSession(s)) {
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
