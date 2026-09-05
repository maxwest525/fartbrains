import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
// Permanent account deletion.
//
// Removes everything the customer owns and then the auth user itself. Requires a
// recently authenticated session: the client re-verifies the customer's password
// immediately before calling, and this function additionally refuses a token
// whose session began more than RECENT_AUTH_SECONDS ago, so a stolen or
// long-lived token cannot destroy an account on its own.
//
// The audit row records that a deletion happened and its outcome. It never
// records the customer's content.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { requireUser } from "../_shared/user-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** How recently the customer must have proved who they are. */
const RECENT_AUTH_SECONDS = 15 * 60;

// Deleted dependents-first. Most of these cascade from auth.users anyway, but
// deleting explicitly means a missing ON DELETE CASCADE cannot silently leave a
// customer's private rows behind after they asked us to remove them.
//
// That reasoning only holds if the list is complete, and it was not: drafts,
// captured sources and their versions and chunks, projects, jobs and the
// subscription row were all absent, so the tables holding the most content in
// the product were exactly the ones trusting the cascade this list exists to
// distrust. A test derives the owned set from the migrations and fails when a
// new table is neither listed here nor deliberately excluded.
//
// Tables that do not exist in a given environment are skipped, not failed —
// several of these ship in migrations that may not be applied yet.
export const OWNED_TABLES = [
  // Derived rows first, so a delete never trips a foreign key on its way out.
  "evidence_spans",
  "source_chunks",
  "source_versions",
  "idea_shares",
  "idea_references",
  "idea_reminders",
  "idea_chats",
  "event_gifts",
  "calendar_events",
  "todos",
  "user_drafts",
  "user_instructions",
  "push_subscriptions",
  "ai_usage_events",
  "transcription_jobs",
  "jobs",
  "sources",
  "ideas",
  "projects",
  "folders",
  "subscriptions",
  "profiles",
] as const;

function sessionAgeSeconds(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    // auth_time is when the session was established; iat is this token's issue
    // time. Prefer auth_time so a silent refresh does not look like a fresh login.
    const at = Number(payload.auth_time ?? payload.iat ?? 0);
    if (!at) return null;
    return Math.floor(Date.now() / 1000) - at;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req, cors);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const age = sessionAgeSeconds(token);
  if (age === null || age > RECENT_AUTH_SECONDS) {
    return json(
      { error: "Please sign in again before deleting your account.", code: "reauth_required" },
      401,
    );
  }

  // The client must repeat the exact confirmation phrase, so an accidental or
  // scripted POST cannot destroy an account.
  const body = await req.json().catch(() => ({}));
  if ((body as { confirm?: unknown }).confirm !== "DELETE") {
    return json({ error: "Confirmation missing.", code: "confirm_required" }, 400);
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const failed: string[] = [];
  for (const table of OWNED_TABLES) {
    const { error } = await svc.from(table).delete().eq(
      table === "profiles" ? "id" : "user_id",
      userId,
    );
    // A table that does not exist yet in this environment is not a failure to
    // delete the customer's data.
    if (error && !/does not exist/i.test(error.message)) {
      console.error(`delete-account: ${table} failed`, error.message);
      failed.push(table);
    }
  }

  if (failed.length) {
    return json(
      {
        error: "We couldn't remove everything. Nothing has been deleted from your login yet — contact support.",
        code: "partial_failure",
      },
      500,
    );
  }

  const { error: authErr } = await svc.auth.admin.deleteUser(userId);
  if (authErr) {
    console.error("delete-account: auth user delete failed", authErr.message);
    return json({ error: "Couldn't finish deleting your account.", code: "auth_delete_failed" }, 500);
  }

  console.log(JSON.stringify({ event: "account_deleted", user_id: userId, at: new Date().toISOString() }));
  return json({ status: "deleted" });
});
