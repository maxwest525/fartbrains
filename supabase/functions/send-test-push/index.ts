// Sends a one-off test web-push to every device the authenticated user
// is subscribed on. Lets the user verify push works end-to-end from Settings.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT_RAW = Deno.env.get("VAPID_SUBJECT") ?? "";

const normalizeSubject = (raw: string) => {
  const v = raw.trim();
  if (!v) return "mailto:noreply@idea-vault.app";
  if (v.startsWith("mailto:") || v.startsWith("https://")) return v;
  if (v.includes("@")) return `mailto:${v}`;
  return "mailto:noreply@idea-vault.app";
};

let pushReady = false;
const initPush = () => {
  if (pushReady) return true;
  try {
    webpush.setVapidDetails(normalizeSubject(VAPID_SUBJECT_RAW), VAPID_PUBLIC, VAPID_PRIVATE);
    pushReady = true;
    return true;
  } catch (e) {
    console.error("web-push init failed", e);
    return false;
  }
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // AuthN: validate JWT in code (functions run with verify_jwt = false).
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid auth" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  if (!initPush()) {
    return new Response(JSON.stringify({ error: "Push not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: subs, error: subsErr } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);
  if (subsErr) {
    return new Response(JSON.stringify({ error: subsErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!subs?.length) {
    return new Response(
      JSON.stringify({ ok: false, sent: 0, reason: "No devices subscribed yet." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const payload = JSON.stringify({
    title: "Test notification",
    body: "Push is working on this device. You'll get reminders here.",
    tag: `test:${Date.now()}`,
    url: "/",
  });

  let sent = 0;
  let removed = 0;
  const errors: string[] = [];
  await Promise.all(
    subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent += 1;
      } catch (e: unknown) {
        const status =
          (e as { statusCode?: number })?.statusCode ??
          (e as { status?: number })?.status;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          removed += 1;
        } else {
          errors.push(`${status ?? "?"}: ${(e as Error)?.message ?? "send failed"}`);
        }
      }
    }),
  );

  return new Response(
    JSON.stringify({ ok: sent > 0, sent, removed, devices: subs.length, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
