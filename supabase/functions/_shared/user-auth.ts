// Shared JWT validation for edge functions that run with verify_jwt=false.
// Ensures only authenticated callers can consume paid AI / API resources.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

export type AuthedUser = { id: string; email: string | null };

/** Returns the authenticated user, or a Response to return immediately. */
export async function requireUser(
  req: Request,
  cors: Record<string, string>,
): Promise<{ user: AuthedUser } | { response: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      }),
    };
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return {
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      }),
    };
  }
  return { user: { id: data.user.id, email: data.user.email ?? null } };
}
