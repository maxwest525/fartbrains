import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
// Pull-based bridge for a customer's desktop notes app.
//
// The desktop polls, with that customer's own Supabase access token:
//   GET /functions/v1/notes-feed?since=<ISO>
//   Authorization: Bearer <user access token>
//
// Returns, FOR THAT USER ONLY:
//   - notes:     ideas updated since the cursor (oldest-first)
//   - todos:     current todos snapshot
//   - reminders: today's outstanding reminders (idea + folder)
//   - cursor:    advance to last note's updated_at
//
// This used to run with the service-role key, no user filter, gated by a single
// shared NOTES_FEED_TOKEN — a full cross-tenant dump of every customer's notes,
// todos and reminders. It now runs as the calling user so row level security
// enforces isolation, with an explicit user_id filter as defence in depth.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { requireUser } from "../_shared/user-auth.ts";

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const auth = await requireUser(req, cors);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "100") || 100, 1), 500);

  // Act as the caller: RLS applies, so a bug in a filter below cannot leak
  // another customer's rows.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  let q = supabase
    .from("ideas")
    .select("id,title,raw_note,ai_summary,source_url,source_label,tags,created_at,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (since) q = q.gt("updated_at", since);

  // Today's window for reminders.
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  const [notesRes, todosRes, ideaRemRes, folderRemRes] = await Promise.all([
    q,
    supabase
      .from("todos")
      .select("id,title,done,due_at,completed_at,created_at,updated_at")
      .eq("user_id", userId)
      .order("done", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("idea_reminders")
      .select("id,idea_id,remind_at")
      .eq("user_id", userId)
      .gte("remind_at", start.toISOString())
      .lte("remind_at", end.toISOString())
      .is("fired_at", null),
    supabase
      .from("folders")
      .select("id,name,remind_at")
      .eq("user_id", userId)
      .not("remind_at", "is", null)
      .gte("remind_at", start.toISOString())
      .lte("remind_at", end.toISOString()),
  ]);

  if (notesRes.error) {
    console.error("notes-feed query failed", notesRes.error.message);
    return new Response(JSON.stringify({ error: "Could not load feed" }), {
      status: 500, headers: { ...cors, "content-type": "application/json" },
    });
  }

  const notes = (notesRes.data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.ai_summary || r.raw_note || "",
    url: r.source_url,
    source: r.source_label,
    tags: r.tags,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  // Resolve idea titles for idea-reminders (still owner-scoped).
  const ideaIds = (ideaRemRes.data ?? []).map((r) => r.idea_id);
  let ideaTitles: Record<string, string> = {};
  if (ideaIds.length) {
    const { data } = await supabase
      .from("ideas")
      .select("id,title")
      .eq("user_id", userId)
      .in("id", ideaIds);
    ideaTitles = Object.fromEntries((data ?? []).map((i) => [i.id, i.title]));
  }

  const reminders = [
    ...(ideaRemRes.data ?? []).map((r) => ({
      id: r.id,
      title: ideaTitles[r.idea_id] ?? "Idea reminder",
      fire_at: r.remind_at,
      source: "idea" as const,
    })),
    ...(folderRemRes.data ?? []).map((f) => ({
      id: f.id,
      title: f.name,
      fire_at: f.remind_at,
      source: "folder" as const,
    })),
  ].sort((a, b) => a.fire_at.localeCompare(b.fire_at));

  const cursor = notes.length ? notes[notes.length - 1].updated_at : since ?? null;

  return new Response(
    JSON.stringify({ notes, todos: todosRes.data ?? [], reminders, cursor }),
    { headers: { ...cors, "content-type": "application/json" } },
  );
});
