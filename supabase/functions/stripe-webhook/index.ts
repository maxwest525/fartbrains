// Stripe webhook: the only writer of billing state.
//
// Three things this must get right:
//   1. Verify the signature. An unverified webhook endpoint lets anyone grant
//      themselves a subscription.
//   2. Be idempotent. Stripe delivers at least once; a replayed event must not
//      double-apply. billing_events.id is the Stripe event id and its primary
//      key, so a duplicate insert fails and we stop.
//   3. Never trust the client. The user is resolved from the Stripe customer
//      or subscription metadata, never from the request body.
//
// verify_jwt must be OFF for this function — Stripe cannot send a Supabase JWT.
// The signature check is the authentication.

import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { planForPrice, type SubscriptionStatus } from "../_shared/billing.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

const RELEVANT = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
]);

const iso = (unix: number | null | undefined): string | null =>
  unix ? new Date(unix * 1000).toISOString() : null;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret || !webhookSecret) {
    console.error("stripe-webhook: configuration missing");
    return json({ error: "not_configured" }, 503);
  }

  const stripe = new Stripe(secret, { apiVersion: "2025-01-27.acacia" });
  const signature = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, webhookSecret);
  } catch (e) {
    console.error("stripe-webhook: signature verification failed", e instanceof Error ? e.message : e);
    return json({ error: "invalid_signature" }, 400);
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Idempotency gate: the primary key rejects a replay before any state moves.
  const { error: claimErr } = await svc
    .from("billing_events")
    .insert({ id: event.id, type: event.type, status: "processing" });
  if (claimErr) {
    // Duplicate delivery is the expected case, and is a success from Stripe's
    // point of view — returning 200 stops it retrying forever.
    console.log(JSON.stringify({ event: "webhook_duplicate", id: event.id, type: event.type }));
    return json({ received: true, duplicate: true });
  }

  const finish = async (status: string, userId: string | null, error?: string) => {
    await svc
      .from("billing_events")
      .update({ status, user_id: userId, error: error ?? null })
      .eq("id", event.id);
  };

  if (!RELEVANT.has(event.type)) {
    await finish("ignored", null);
    return json({ received: true });
  }

  try {
    // Resolve the customer id for every relevant event shape.
    const obj = event.data.object as Record<string, unknown>;
    const customerId =
      typeof obj.customer === "string"
        ? obj.customer
        : (obj.customer as { id?: string } | undefined)?.id ?? null;

    // Prefer metadata we set ourselves; fall back to the stored mapping.
    let userId =
      ((obj.metadata as Record<string, string> | undefined)?.supabase_user_id) ??
      (typeof obj.client_reference_id === "string" ? obj.client_reference_id : null) ??
      null;

    if (!userId && customerId) {
      const { data } = await svc
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      userId = (data as { user_id?: string } | null)?.user_id ?? null;
    }

    if (!userId) {
      console.error("stripe-webhook: could not resolve user", event.type, customerId);
      await finish("failed", null, "unresolved_user");
      // 200: retrying will not help, and a stuck retry loop hides real failures.
      return json({ received: true });
    }

    // Load the authoritative subscription from Stripe rather than trusting the
    // event payload's shape, so every event type converges on the same state.
    let sub: Stripe.Subscription | null = null;
    if (event.type.startsWith("customer.subscription.")) {
      sub = event.data.object as Stripe.Subscription;
    } else if (customerId) {
      const list = await stripe.subscriptions.list({ customer: customerId, limit: 1, status: "all" });
      sub = list.data[0] ?? null;
    }

    if (!sub) {
      await svc.from("subscriptions").upsert(
        { user_id: userId, stripe_customer_id: customerId, status: "free" as SubscriptionStatus },
        { onConflict: "user_id" },
      );
      await finish("processed", userId);
      return json({ received: true });
    }

    const priceId = sub.items.data[0]?.price?.id ?? null;
    const status = (event.type === "customer.subscription.deleted"
      ? "canceled"
      : sub.status) as SubscriptionStatus;

    await svc.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status,
        price_id: priceId,
        plan_key: planForPrice(priceId),
        current_period_end: iso((sub as unknown as { current_period_end?: number }).current_period_end),
        cancel_at_period_end: sub.cancel_at_period_end ?? false,
        trial_end: iso(sub.trial_end),
      },
      { onConflict: "user_id" },
    );

    console.log(JSON.stringify({
      event: "subscription_updated", type: event.type, user_id: userId, status,
    }));
    await finish("processed", userId);
    return json({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    console.error("stripe-webhook: processing failed", event.type, message);
    await finish("failed", null, message);
    // 500 asks Stripe to retry; the idempotency row is marked failed, and a
    // retry carries the same event id, so re-processing needs the row cleared.
    await svc.from("billing_events").delete().eq("id", event.id);
    return json({ error: "processing_failed" }, 500);
  }
});
