import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
// Opens the Stripe Customer Portal so the customer can change payment method,
// switch plan, or cancel. Cancelling must stay available even to a past_due or
// cancelled account — never trap someone in a subscription.

import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";
import { requireUser } from "../_shared/user-auth.ts";

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
  const appUrl = Deno.env.get("APP_URL") ?? "";
  if (!secret || !appUrl) {
    console.error("create-portal-session: Stripe configuration missing");
    return json({ error: "Billing isn't available right now.", code: "not_configured" }, 503);
  }

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data } = await svc
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const customerId = (data as { stripe_customer_id?: string } | null)?.stripe_customer_id;
  if (!customerId) {
    return json({ error: "You don't have a billing account yet.", code: "no_customer" }, 404);
  }

  try {
    const stripe = new Stripe(secret, { apiVersion: "2025-01-27.acacia" });
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("create-portal-session failed", e instanceof Error ? e.message : e);
    return json({ error: "Couldn't open billing. Try again in a moment." }, 500);
  }
});
