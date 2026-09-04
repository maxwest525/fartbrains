-- Purpose: subscriptions, entitlements and an idempotent webhook log.
--
-- The product had no billing at all. Entitlements must be decided server-side
-- from a real subscription row — never from a frontend boolean — and Stripe
-- delivers webhooks at least once, so replays must be safe.
--
-- Pricing is deliberately NOT encoded here: price IDs come from environment
-- configuration so the owner can choose public pricing later without a
-- migration. What is stored is the customer's state, not the catalogue.
--
-- Additive and idempotent. Rollback: DROP both tables.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id    text UNIQUE,
  stripe_subscription_id text UNIQUE,
  -- free | trialing | active | past_due | incomplete | unpaid | canceled
  status                text NOT NULL DEFAULT 'free',
  price_id              text,
  plan_key              text,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean NOT NULL DEFAULT false,
  trial_end             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_customer_idx
  ON public.subscriptions (stripe_customer_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Customers may read their own subscription so the UI can show plan and
-- renewal date. They may never write it: only verified Stripe webhooks, via the
-- service role, change billing state.
DROP POLICY IF EXISTS "Users read own subscription" ON public.subscriptions;
CREATE POLICY "Users read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Webhook idempotency + audit. Stripe retries, and a duplicate delivery must
-- not double-apply. The unique event id is the idempotency key.
CREATE TABLE IF NOT EXISTS public.billing_events (
  id           text PRIMARY KEY,          -- Stripe event id (evt_...)
  type         text NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'processed',  -- processed | ignored | failed
  error        text
);

CREATE INDEX IF NOT EXISTS billing_events_user_idx
  ON public.billing_events (user_id, processed_at DESC);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
-- No policies: this log is service-role only. Customers see their plan through
-- public.subscriptions, not the raw event stream.

CREATE OR REPLACE FUNCTION public.touch_subscription_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS subscriptions_touch_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_subscription_updated_at();
