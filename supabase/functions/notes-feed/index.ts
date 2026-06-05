// Pull-based bridge for the user's desktop notes app.
//
// The desktop polls:
//   GET https://uwuhfvhqnpozhndrabwl.supabase.co/functions/v1/notes-feed?since=<ISO>
//
// Returns ideas updated since the timestamp (oldest-first) so the desktop
// can append them to database.json and advance its cursor.
//
// No auth: this project auto-signs every visitor in as the same admin
// account (see ProtectedRoute), so the ideas table isn't actually private.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const since = url.searchParams.get("since");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let q = supabase
    .from("ideas")
    .select("id,title,raw_note,ai_summary,source_url,source_label,tags,created_at,updated_at")
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (since) q = q.gt("updated_at", since);

  const { data, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors, "content-type": "application/json" },
    });
  }

  const notes = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    body: r.ai_summary || r.raw_note || "",
    url: r.source_url,
    source: r.source_label,
    tags: r.tags,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  const cursor = notes.length ? notes[notes.length - 1].updated_at : since ?? null;

  return new Response(JSON.stringify({ notes, cursor }), {
    headers: { ...cors, "content-type": "application/json" },
  });
});
