import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
import { requireUser } from "../_shared/user-auth.ts";
import { safeFetch } from "../_shared/ssrf.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Delivers one captured idea to the webhook its folder owner configured.
//
// The destination is chosen by a customer, which makes this the one place in
// the product where an authenticated user picks a URL the server will fetch.
// That is the definition of SSRF, so delivery goes through safeFetch: the
// address is validated before the first request and re-validated on every
// redirect hop, and private, loopback and link-local ranges are refused. A
// webhook is not a way to ask our infrastructure to talk to itself.
//
// Runs server-side rather than in the browser for three reasons: the browser
// cannot keep a signing secret, most endpoints would refuse a cross-origin
// POST from a web page anyway, and a customer's notes should not depend on
// their tab staying open.

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

/** How long the receiver gets before we give up. */
const TIMEOUT_MS = 10_000;
/** Body cap. A note is text; anything larger is a mistake we should not send. */
const MAX_BODY_BYTES = 512 * 1024;

const svc = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

async function sign(secret: string, body: string, timestamp: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  // The timestamp is inside the signed string, so a captured delivery cannot be
  // replayed later with a fresh header.
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req, cors);
  if ("response" in auth) return auth.response;
  const userId = auth.user.id;

  const body = await req.json().catch(() => ({}));
  const ideaId = String((body as { idea_id?: unknown }).idea_id ?? "");
  const folderId = String((body as { folder_id?: unknown }).folder_id ?? "");
  const isTest = (body as { test?: unknown }).test === true;
  if (!folderId) return json({ error: "folder_id required", code: "bad_request" }, 400);

  const client = svc();

  // Scoped by user_id as well as folder_id: the folder id came from the
  // request, and a caller must not be able to make us read another account's
  // webhook by naming their folder.
  const { data: hookRow, error: hookErr } = await client
    .from("folder_webhooks")
    .select("url, secret, enabled, include_note, include_summary, delivery_count")
    .eq("folder_id", folderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (hookErr) return json({ error: "Could not read the webhook" }, 500);
  if (!hookRow) return json({ status: "no_webhook" });

  const hook = hookRow as {
    url: string;
    secret: string;
    enabled: boolean;
    include_note: boolean;
    include_summary: boolean;
    delivery_count: number;
  };
  if (!hook.enabled) return json({ status: "disabled" });

  let payload: Record<string, unknown>;
  if (isTest) {
    payload = {
      event: "test",
      sent_at: new Date().toISOString(),
      folder_id: folderId,
      idea: {
        id: "00000000-0000-0000-0000-000000000000",
        title: "Test delivery from Fartbrains",
        note: hook.include_note ? "If you can read this, your endpoint is reachable and the signature checks out." : null,
        summary: null,
        source_url: null,
        tags: ["test"],
      },
    };
  } else {
    if (!ideaId) return json({ error: "idea_id required", code: "bad_request" }, 400);
    const { data: ideaRow } = await client
      .from("ideas")
      .select("id, title, raw_note, ai_summary, source_url, tags, folder_id, created_at, deleted_at")
      .eq("id", ideaId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!ideaRow) return json({ status: "not_found" });

    const idea = ideaRow as {
      id: string; title: string | null; raw_note: string | null; ai_summary: string | null;
      source_url: string | null; tags: string[] | null; folder_id: string | null;
      created_at: string; deleted_at: string | null;
    };
    // A trashed idea is not forwarded. Deleting is how people take something
    // back, and it should not still be on its way out the door.
    if (idea.deleted_at) return json({ status: "trashed" });
    if (idea.folder_id !== folderId) return json({ status: "moved" });

    payload = {
      event: "idea.captured",
      sent_at: new Date().toISOString(),
      folder_id: folderId,
      idea: {
        id: idea.id,
        title: idea.title,
        note: hook.include_note ? idea.raw_note : null,
        summary: hook.include_summary ? idea.ai_summary : null,
        source_url: idea.source_url,
        tags: idea.tags ?? [],
        captured_at: idea.created_at,
      },
    };
  }

  const raw = JSON.stringify(payload);
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ status: "too_large" });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await sign(hook.secret, raw, timestamp);

  let status: number | null = null;
  let error: string | null = null;
  try {
    const resp = await safeFetch(
      hook.url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Fartbrains-Webhook/1",
          "X-Fartbrains-Event": String(payload.event),
          "X-Fartbrains-Timestamp": timestamp,
          "X-Fartbrains-Signature": `sha256=${signature}`,
        },
        body: raw,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      { maxRedirects: 3 },
    );
    status = resp.status;
    if (!resp.ok) error = `Endpoint returned ${resp.status}`;
    // The response body is never read into the vault. We asked it to receive
    // something, not to tell us anything.
    await resp.body?.cancel();
  } catch (e) {
    error = e instanceof Error ? e.message : "Delivery failed";
  }

  // A test does not count as a delivery, but its result is still what the
  // owner needs to see on the settings screen.
  await client
    .from("folder_webhooks")
    .update({
      last_status: status,
      last_error: error ? String(error).slice(0, 500) : null,
      last_delivered_at: new Date().toISOString(),
      delivery_count: isTest ? hook.delivery_count : hook.delivery_count + 1,
    })
    .eq("folder_id", folderId)
    .eq("user_id", userId);

  if (error) return json({ status: "failed", http_status: status, error }, 200);
  return json({ status: "delivered", http_status: status });
});
