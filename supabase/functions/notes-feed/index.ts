// Pull-based bridge for the user's desktop notes app.
//
// The desktop process polls:
//   GET https://<project>.functions.supabase.co/notes-feed?since=<ISO>
//   Header: Authorization: Bearer <SYNC_TOKEN>
//
// Returns the ideas created/updated since the timestamp, oldest-first, so the
// desktop can append them to its local database.json and advance its cursor.
//
// Why pull (not push from the web app):
//   - The Lovable app is served over HTTPS; browsers block direct POSTs to
//     http://192.168.x.x:5176 as mixed content.
//   - The desktop is already running its own server, so adding a tiny poll
//     loop is trivial and works from any network.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const expected = Deno.env.get("SYNC_TOKEN");
  if (!expected) {
    return new Response(JSON.stringify({ error: "SYNC_TOKEN not configured" }), {
      status: 500, headers: { ...cors, "content-type": "application/json" },
    });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  const url = new URL(req.url);
  // Allow ?token=... as a fallback for iOS Shortcuts / simple clients.
  const queryToken = url.searchParams.get("token") ?? "";
  if (token !== expected && queryToken !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...cors, "content-type": "application/json" },
    });
  }

  const since = url.searchParams.get("since"); // ISO timestamp, optional
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
