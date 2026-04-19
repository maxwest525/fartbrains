import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isEmailAllowed } from "@/lib/allowlist";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && !isEmailAllowed(user.email)) {
      supabase.auth.signOut();
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user || !isEmailAllowed(user.email)) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
