# Stripe setup — step by step

Nothing here has been run. The code is written and merged; this is the
configuration and the test pass that turn it on.

Do the whole thing in **test mode** first. Live keys only after every box below
is ticked in test mode.

## 1. Create the product and price
Stripe Dashboard → Products → Add product.

- Name: `Fartbrains Pro`
- Recurring, monthly. Draft price is **$9/month** — see `docs/PRICING.md`, and
  read the cost check there before committing to a number.
- Optionally add a second **$90/year** price on the same product.
- Copy the **price ID** (`price_…`, not the product ID).

## 2. Set the secrets
In Lovable → Cloud → Secrets (never in a `VITE_*` variable — those ship to every
browser):

| Secret | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `STRIPE_PRICE_ID_PRO` | the `price_…` from step 1 |
| `APP_URL` | your production origin, e.g. `https://fartbrains.app` |
| `ALLOWED_ORIGIN` | the same origin (also pins CORS on every edge function) |
| `STRIPE_WEBHOOK_SECRET` | filled in at step 3 |

## 3. Create the webhook endpoint
Stripe → Developers → Webhooks → Add endpoint.

- URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- Events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

⚠️ `stripe-webhook` must have **`verify_jwt` off** — Stripe cannot send a
Supabase JWT. The signature check *is* the authentication, and the function
refuses every request until `STRIPE_WEBHOOK_SECRET` is set, so it fails closed.

## 4. Enable the Customer Portal
Stripe → Settings → Billing → Customer portal. Turn it on, and allow customers
to **cancel**. Never trap someone in a subscription.

## 5. Deploy

📋 **LOVABLE PROMPT:**
> "Deploy all edge functions"

## 6. Test-mode lifecycle
Card `4242 4242 4242 4242`, any future expiry, any CVC.

- [ ] New account → Settings → Billing → Upgrade → checkout completes.
- [ ] `subscriptions` row for that user reads `status = 'active'`.
- [ ] AI features work; usage rows land in `ai_usage_events`.
- [ ] **Replay a webhook** from the Stripe dashboard. The second delivery is
      rejected by the primary-key collision on `billing_events.id` and the
      subscription is unchanged. This is the idempotency check — if a replay
      double-applies, stop and fix it before going live.
- [ ] Failed payment (card `4000 0000 0000 0341`) → status `past_due`, access
      retained, customer told to update their card.
- [ ] Cancel in the portal → status `canceled`; notes still readable,
      searchable and exportable; AI features stop.
- [ ] Resubscribe → `active` again, and **no duplicate Stripe customer** was
      created for that user.
- [ ] Delete the account (Settings → Data) with a live subscription and confirm
      the flow tells you to cancel billing first.

## 7. Going live
- [ ] Repeat steps 1–4 with live keys and a live price ID.
- [ ] Swap the secrets to `sk_live_…` and the live `whsec_…`.
- [ ] Run at least one real card end to end, then refund it.
- [ ] Confirm the price shown in `BillingSection.tsx` matches the live price.
      It is currently hardcoded draft copy marked WIP — update it when the real
      number is decided.

## Known gaps
- Entitlements are enforced server-side in `_shared/billing.ts`, but no plan
  currently blocks `PAID_ONLY` operations outright — `ai-guard` enforces the
  *quota* difference between plans, not a hard feature gate. Decide whether
  free should be "fewer AI actions" (today's behaviour) or "no AI actions".
- Usage against plan limits is recorded but not shown to the customer.
- Trials are configured in Stripe, not in code; nothing in the app explains
  trial length yet.
