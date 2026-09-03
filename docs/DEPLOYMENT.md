# Deployment and operations

No secrets belong in this repository. Everything below is configured in the
hosting provider and in Supabase → Edge Functions → Secrets.

## Frontend environment variables (Vite, baked into the bundle — public)
| Variable | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | yes | Anon key. Public by design; RLS is what protects data. |
| `VITE_SUPABASE_PROJECT_ID` | yes | |
| `VITE_ENABLE_PHONE_AUTH` | no | `true` only once an SMS provider is configured **and tested**. Default off. |

Never put a service-role key, Stripe secret, or any provider API key in a
`VITE_*` variable — those are shipped to every browser.

## Edge function secrets (server-side only)
| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | all | Supplied by Supabase. |
| `APP_URL` | checkout, portal | Production origin, e.g. `https://fartbrains.app`. Used for Stripe return URLs. |
| `STRIPE_SECRET_KEY` | checkout, portal, webhook | Test key first. |
| `STRIPE_WEBHOOK_SECRET` | webhook | From the Stripe endpoint. Without it the webhook refuses every request. |
| `STRIPE_PRICE_ID_PRO` | checkout | The price customers check out on. Pricing is not hard-coded anywhere. |
| `LOVABLE_API_KEY` | AI routes | |
| Transcription / scraping provider keys | transcribe-*, extract-* | As already configured. |
| Email provider + sender domain | send-transactional-email, process-email-queue | See below. |

`NOTES_FEED_TOKEN` is **no longer used** — `notes-feed` now authenticates the
caller. Remove it and update any desktop poller to send the customer's own
access token.

## Migrations to apply, in order
These are written but **not applied**; this repository's CI has no database
access. Apply and then run the verification listed with each.

1. `20260903120000_rls_update_with_check.sql` — verify with two accounts that
   A cannot update B's rows and cannot reassign `user_id`.
2. `20260903130000_idea_shares.sql` — verify a share resolves, a revoked one
   does not, and `anon` cannot select from `ideas` or call
   `resolve_idea_share`.
3. `20260903140000_ai_usage.sql` — verify a rate-limited call returns 429 and
   writes a row, and that no note content appears in `ai_usage_events`.
4. `20260903150000_trash.sql` — verify delete → restore round-trips, that
   trashing revokes share links, and schedule `purge_expired_trash()` daily
   (pg_cron or a scheduled function). **The schedule does not exist yet.**
5. `20260903160000_billing.sql` — then run the Stripe checklist below.

After applying, regenerate `src/integrations/supabase/types.ts` from the live
schema; the entries added by hand in this branch are a stand-in.

## Edge function JWT settings
| Function | `verify_jwt` | Why |
|---|---|---|
| `stripe-webhook` | **off** | Stripe cannot send a Supabase JWT; the signature check is the authentication. |
| `resolve-share` | **off** | The one public route; the share token is the authorization. |
| `handle-email-unsubscribe`, `handle-email-suppression` | off | Called by the email provider. |
| everything else | on or off | All AI routes authenticate in-function via `requireUser`; leaving `verify_jwt` on as well is fine and preferred. |

## Stripe checklist
Test mode first, end to end, before touching live keys.
- [ ] Product and price created; price id in `STRIPE_PRICE_ID_PRO`.
- [ ] Webhook endpoint → `.../functions/v1/stripe-webhook`, subscribed to
      `checkout.session.completed`, `customer.subscription.created`,
      `customer.subscription.updated`, `customer.subscription.deleted`,
      `invoice.payment_failed`, `invoice.payment_succeeded`.
- [ ] `STRIPE_WEBHOOK_SECRET` set from that endpoint.
- [ ] Customer Portal enabled, with cancellation allowed.
- [ ] New user → checkout → subscription row becomes `active`.
- [ ] Replay the same webhook event: `billing_events` rejects it, state unchanged.
- [ ] Force a failed payment: status becomes `past_due`, access is retained,
      the customer is told to update their card.
- [ ] Cancel in the portal: status becomes `canceled`, notes stay readable,
      searchable and exportable, AI features stop.
- [ ] Resubscribe: back to `active` with no duplicate Stripe customer.
- [ ] Then repeat the whole list against live keys.

## Supabase checklist
- [ ] All migrations above applied.
- [ ] RLS confirmed enabled on every user-owned table, including the new
      `idea_shares`, `ai_usage_events`, `subscriptions` and `billing_events`.
- [ ] Auth redirect URLs include the production origin and `/reset-password`.
- [ ] Email confirmation required for signup.
- [ ] Anonymous sign-ins **disabled** in Auth settings — the client no longer
      creates them, and disabling it server-side closes the door for good.
- [ ] Daily schedule for `purge_expired_trash()`.

## Email checklist
- [ ] Sending domain verified (SPF, DKIM, DMARC).
- [ ] From address on that domain; reply-to monitored.
- [ ] Transactional mail separated from optional product mail.
- [ ] Unsubscribe and suppression endpoints reachable from the provider.

## Monitoring checklist
Not yet implemented — see `docs/PRODUCTION_READINESS.md`. At minimum, before
launch: frontend error reporting, edge function error alerting, and an alert on
repeated `billing_events.status = 'failed'`.
