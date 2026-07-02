// Pull-based bridge for the user's desktop notes app.
//
// The desktop polls:
//   GET https://uwuhfvhqnpozhndrabwl.supabase.co/functions/v1/notes-feed?since=<ISO>
//
// Returns:
//   - notes:     ideas updated since the cursor (oldest-first)
//   - todos:     current todos snapshot (open + recently-completed)
//   - reminders: today's outstanding reminders (idea + folder)
//   - cursor:    advance to last note's updated_at
//
// No auth: this project auto-signs every visitor in as the same admin
// account (see ProtectedRoute), so the underlying tables are owner-only
// but effectively single-tenant.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // AuthZ: require the shared NOTES_FEED_TOKEN (single-tenant desktop poller).
  const expected = Deno.env.get("NOTES_FEED_TOKEN") ?? "";
  const provided =
    req.headers.get("x-notes-feed-token") ??
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "content-type": "application/json" },
    });
  }


  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // --- notes (existing behavior) ---
  let q = supabase
    .from("ideas")
    .select("id,title,raw_note,ai_summary,source_url,source_label,tags,created_at,updated_at")
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
      .order("done", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("idea_reminders")
      .select("id,idea_id,remind_at")
      .gte("remind_at", start.toISOString())
      .lte("remind_at", end.toISOString())
      .is("fired_at", null),
    supabase
      .from("folders")
      .select("id,name,remind_at")
      .not("remind_at", "is", null)
      .gte("remind_at", start.toISOString())
      .lte("remind_at", end.toISOString()),
  ]);

  if (notesRes.error) {
    return new Response(JSON.stringify({ error: notesRes.error.message }), {
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

  // Resolve idea titles for idea-reminders.
  const ideaIds = (ideaRemRes.data ?? []).map((r) => r.idea_id);
  let ideaTitles: Record<string, string> = {};
  if (ideaIds.length) {
    const { data } = await supabase.from("ideas").select("id,title").in("id", ideaIds);
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
    JSON.stringify({
      notes,
      todos: todosRes.data ?? [],
      reminders,
      cursor,
    }),
    { headers: { ...cors, "content-type": "application/json" } },
  );
});
