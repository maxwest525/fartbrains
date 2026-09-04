import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
import { requireUser } from "../_shared/user-auth.ts";
import { assertPublicUrl, safeFetch } from "../_shared/ssrf.ts";
// Lightweight URL reachability check. Returns whether the URL responds with a
// successful status, plus the final status code and (if redirected) the final
// URL. Designed for live "is this link reachable?" feedback in the compose form.
//
// Strategy: HEAD first (cheap), fall back to a ranged GET if HEAD is blocked
// (lots of sites return 405/403 to HEAD). Total fetch is bounded by an
// AbortController so the UI never waits more than a few seconds.

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIMEOUT_MS = 6_000;
const UA =
  "Mozilla/5.0 (compatible; IdeaVaultBot/1.0; +https://lovable.dev) Lovable-Check-URL";

type CheckResult = {
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  redirected: boolean;
  /** machine-readable reason when ok=false */
  reason?: "invalid_url" | "unsupported_scheme" | "timeout" | "network" | "http_error";
  message?: string;
};

const json = (body: CheckResult, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Bounded fetch helper. Resolves with the Response or throws on abort/error. */
async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _auth = await requireUser(req, corsHeaders);
  if ("response" in _auth) return _auth.response;

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return json(
      { ok: false, status: null, finalUrl: null, redirected: false, reason: "invalid_url", message: "Invalid request body" },
      400,
    );
  }

  const raw = (body.url ?? "").trim();
  if (!raw) {
    return json({ ok: false, status: null, finalUrl: null, redirected: false, reason: "invalid_url", message: "URL required" }, 400);
  }

  let target: URL;
  try {
    target = await assertPublicUrl(raw.includes("://") ? raw : `https://${raw}`);
  } catch (e) {
    return json({
      ok: false,
      status: null,
      finalUrl: null,
      redirected: false,
      reason: "invalid_url",
      message: e instanceof Error ? e.message : "Not a valid URL",
    });
  }

  const tryFetch = async (method: "HEAD" | "GET") => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      return await safeFetch(target.toString(), {
        method,
        signal: ctrl.signal,
        headers: {
          "User-Agent": UA,
          Accept: "*/*",
          ...(method === "GET" ? { Range: "bytes=0-1024" } : {}),
        },
      });
    } finally {
      clearTimeout(t);
    }
  };

  try {
    let resp = await tryFetch("HEAD");
    if (resp.status === 405 || resp.status === 403 || resp.status === 400 || resp.status === 501) {
      resp = await tryFetch("GET");
    }

    const ok = resp.ok || (resp.status >= 200 && resp.status < 400);
    return json({
      ok,
      status: resp.status,
      finalUrl: resp.url || target.toString(),
      redirected: resp.redirected || resp.url !== target.toString(),
      ...(ok
        ? {}
        : { reason: "http_error" as const, message: `HTTP ${resp.status}` }),
    });
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return json({
      ok: false,
      status: null,
      finalUrl: target.toString(),
      redirected: false,
      reason: aborted ? "timeout" : "network",
      message: aborted ? "Took too long to respond" : "Could not reach this URL",
    });
  }
});
