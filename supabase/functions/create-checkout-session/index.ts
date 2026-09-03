import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
// Starts a Stripe Checkout session for the signed-in customer.
//
// The customer never chooses a price id: the plan key maps to an environment
// price so a client cannot check out on a price we did not intend to sell.

import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { requireUser } from "../_shared/user-auth.ts";
import { priceIdFor, type PlanKey } from "../_shared/billing.ts";

const cors = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req, cors);
  if ("response" in auth) return auth.response;

  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) {
    console.error("create-checkout-session: STRIPE_SECRET_KEY missing");
    return json({ error: "Billing isn't available right now.", code: "not_configured" }, 503);
  }

  const body = await req.json().catch(() => ({}));
  const plan = ((body as { plan?: string }).plan ?? "pro") as PlanKey;
  const price = priceIdFor(plan);
  if (!price) return json({ error: "Unknown plan", code: "unknown_plan" }, 400);

  const appUrl = Deno.env.get("APP_URL") ?? "";
  if (!appUrl) {
    console.error("create-checkout-session: APP_URL missing");
    return json({ error: "Billing isn't available right now.", code: "not_configured" }, 503);
  }

  const stripe = new Stripe(secret, { apiVersion: "2025-01-27.acacia" });
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    // Reuse the customer if we already made one, so a returning subscriber does
    // not accumulate duplicate Stripe customers.
    const { data: existing } = await svc
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    let customerId = (existing as { stripe_customer_id?: string } | null)?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.user.email ?? undefined,
        metadata: { supabase_user_id: auth.user.id },
      });
      customerId = customer.id;
      await svc.from("subscriptions").upsert(
        { user_id: auth.user.id, stripe_customer_id: customerId, status: "free" },
        { onConflict: "user_id" },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${appUrl}/?billing=success`,
      cancel_url: `${appUrl}/?billing=cancelled`,
      // Belt and braces: the webhook prefers this over any client-supplied id.
      subscription_data: { metadata: { supabase_user_id: auth.user.id } },
      client_reference_id: auth.user.id,
      allow_promotion_codes: true,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("create-checkout-session failed", e instanceof Error ? e.message : e);
    return json({ error: "Couldn't start checkout. Try again in a moment." }, 500);
  }
});
