// Reminder dispatcher.
// Runs every minute via pg_cron. For each idea/folder whose `remind_at` has
// passed and hasn't been delivered yet, sends:
//   - a Web Push notification to every active subscription for the user
//     (when notify_push is true), and
//   - a transactional email via send-transactional-email
//     (when notify_email is true).
// On success, marks the idea/folder so we don't fire again.
//
// Folder reminders inherit defaults: push=on, email=off.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
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

type DueIdea = {
  id: string;
  user_id: string;
  title: string;
  remind_at: string;
  notify_push: boolean;
  notify_email: boolean;
};

type DueFolder = {
  id: string;
  user_id: string;
  name: string;
  remind_at: string;
};

type PushSub = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const sendPushToUser = async (
  userId: string,
  payload: { title: string; body: string; tag: string; url?: string },
) => {
  if (!initPush()) return { sent: 0, removed: 0 };
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);
  if (error || !subs?.length) return { sent: 0, removed: 0 };

  let sent = 0;
  let removed = 0;
  await Promise.all(
    (subs as PushSub[]).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (e: unknown) {
        const status =
          (e as { statusCode?: number })?.statusCode ??
          (e as { status?: number })?.status;
        // 404/410 = subscription is gone. Clean up so we don't keep retrying.
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          removed += 1;
        } else {
          console.error("push send failed", status, e);
        }
      }
    }),
  );
  return { sent, removed };
};

const sendEmail = async (
  recipientEmail: string,
  subject: string,
  bodyText: string,
  idempotencyKey: string,
) => {
  // Best-effort. send-transactional-email requires the email infra to be
  // provisioned for the project — if it isn't, we just log and move on.
  try {
    const res = await admin.functions.invoke("send-transactional-email", {
      body: {
        templateName: "reminder",
        recipientEmail,
        idempotencyKey,
        templateData: { subject, body: bodyText },
      },
    });
    if (res.error) {
      console.warn("email send error", res.error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("email send exception", e);
    return false;
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = new Date().toISOString();
  const nowIso = new Date().toISOString();

  // 1. Fetch due ideas (not yet fired).
  const { data: ideasData, error: ideasErr } = await admin
    .from("ideas")
    .select("id,user_id,title,remind_at,notify_push,notify_email")
    .lte("remind_at", nowIso)
    .is("reminder_fired_at", null)
    .not("remind_at", "is", null)
    .limit(200);

  if (ideasErr) console.error("ideas query failed", ideasErr);

  // 2. Fetch due folders. Folders track only one timestamp; we treat
  //    `remind_at` itself as the dedupe key (clearing/changing it resets it).
  const { data: foldersData, error: foldersErr } = await admin
    .from("folders")
    .select("id,user_id,name,remind_at")
    .lte("remind_at", nowIso)
    .not("remind_at", "is", null)
    .limit(200);

  if (foldersErr) console.error("folders query failed", foldersErr);

  const ideas = (ideasData ?? []) as DueIdea[];
  const folders = (foldersData ?? []) as DueFolder[];

  // Cache user emails to avoid hammering the auth admin API.
  const emailCache = new Map<string, string | null>();
  const getEmail = async (userId: string): Promise<string | null> => {
    if (emailCache.has(userId)) return emailCache.get(userId)!;
    const { data, error } = await admin.auth.admin.getUserById(userId);
    const email = error ? null : data.user?.email ?? null;
    emailCache.set(userId, email);
    return email;
  };

  let pushSent = 0;
  let emailSent = 0;
  let processed = 0;

  for (const idea of ideas) {
    const tag = `idea:${idea.id}:${idea.remind_at}`;
    if (idea.notify_push) {
      const r = await sendPushToUser(idea.user_id, {
        title: "Idea reminder",
        body: idea.title,
        tag,
        url: "/",
      });
      pushSent += r.sent;
    }
    if (idea.notify_email) {
      const email = await getEmail(idea.user_id);
      if (email) {
        const ok = await sendEmail(
          email,
          `Reminder: ${idea.title}`,
          `This is your reminder for "${idea.title}".`,
          `idea-reminder-${idea.id}-${idea.remind_at}`,
        );
        if (ok) emailSent += 1;
      }
    }
    await admin
      .from("ideas")
      .update({ reminder_fired_at: nowIso })
      .eq("id", idea.id);
    processed += 1;
  }

  // For folders we don't currently store fired_at — clear remind_at to dedupe.
  // This matches the existing client-side notifier's "fire once" behavior.
  for (const folder of folders) {
    const tag = `folder:${folder.id}:${folder.remind_at}`;
    const r = await sendPushToUser(folder.user_id, {
      title: "Folder reminder",
      body: folder.name,
      tag,
      url: "/",
    });
    pushSent += r.sent;
    await admin.from("folders").update({ remind_at: null }).eq("id", folder.id);
    processed += 1;
  }

  return new Response(
    JSON.stringify({
      ok: true,
      startedAt,
      processed,
      pushSent,
      emailSent,
      ideas: ideas.length,
      folders: folders.length,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
