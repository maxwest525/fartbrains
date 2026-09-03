// Public resolver for a single shared idea.
//
// The only unauthenticated route in the product. It takes the raw share token
// from the link, hashes it, and asks resolve_idea_share() for the fields the
// owner opted into. It never reaches public.ideas directly and never returns
// owner identity, folders, tags, chats, reminders or any other idea.
//
// Unknown, revoked and expired tokens are all reported the same way, so the
// response cannot be used to tell live links from dead ones.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json", "cache-control": "no-store" },
  });

// Token shape produced by the owner's browser: 43 base64url chars (32 bytes).
const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

// Per-IP sliding window, to blunt enumeration. Edge instances are short-lived,
// so this is a speed bump rather than a quota; the real protection is that the
// token space is 256 bits.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // bound memory
  return recent.length > MAX_PER_WINDOW;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  if (rateLimited(ip)) return json({ error: "Too many requests" }, 429);

  // Bound the body: nothing legitimate here is larger than a token.
  const raw = await req.text();
  if (raw.length > 512) return json({ status: "invalid" }, 400);

  let token = "";
  try {
    token = String((JSON.parse(raw) as { token?: unknown }).token ?? "");
  } catch {
    return json({ status: "invalid" }, 400);
  }
  if (!TOKEN_RE.test(token)) return json({ status: "invalid" }, 404);

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await svc.rpc("resolve_idea_share", {
    p_token_hash: await sha256Hex(token),
  });

  if (error) {
    console.error("resolve-share failed", error.message);
    return json({ error: "Could not open this link" }, 500);
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return json({ status: "invalid" }, 404);

  return json({
    status: "ok",
    idea: {
      title: row.title ?? "Shared idea",
      note: row.note ?? null,
      summary: row.summary ?? null,
      refs: row.refs ?? [],
      sharedAt: row.shared_at ?? null,
      expiresAt: row.expires_at ?? null,
    },
  });
});
