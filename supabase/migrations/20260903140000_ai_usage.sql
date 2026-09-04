-- Purpose: server-side accounting and rate limiting for every paid AI, model,
-- transcription and scraping operation.
--
-- Without this, one authenticated account can exhaust the provider budget for
-- everyone, and there is no way to price plans or answer "what did this cost".
--
-- PRIVACY: this table stores metadata only. No note bodies, transcripts, chat
-- messages, prompts, completions, scraped page content or search queries are
-- ever written here — only which operation ran, for whom, how big it was, and
-- whether it succeeded.
--
-- Additive and idempotent. Rollback: DROP TABLE public.ai_usage_events.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation      text NOT NULL,
  provider       text,
  model          text,
  input_units    integer,
  output_units   integer,
  estimated_cost numeric(12, 6),
  success        boolean NOT NULL DEFAULT true,
  error_code     text,
  decision       text NOT NULL DEFAULT 'allowed',  -- allowed | rate_limited | quota_exceeded
  request_id     text,
  idea_id        uuid,
  plan           text NOT NULL DEFAULT 'free',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Quota checks are always "this user, since <timestamp>".
CREATE INDEX IF NOT EXISTS ai_usage_user_time_idx
  ON public.ai_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_user_op_time_idx
  ON public.ai_usage_events (user_id, operation, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- Customers may read their own usage (so the UI can show "x of y used"), but
-- never write it: only the edge functions, via the service role, record usage.
DROP POLICY IF EXISTS "Users read own AI usage" ON public.ai_usage_events;
CREATE POLICY "Users read own AI usage" ON public.ai_usage_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Aggregate view for the usage UI — still owner-scoped through the table's RLS.
CREATE OR REPLACE VIEW public.ai_usage_current_month
WITH (security_invoker = true) AS
SELECT
  user_id,
  operation,
  count(*)                                  AS calls,
  count(*) FILTER (WHERE success)           AS succeeded,
  COALESCE(sum(estimated_cost), 0)          AS estimated_cost
FROM public.ai_usage_events
WHERE created_at >= date_trunc('month', now())
  AND decision = 'allowed'
GROUP BY user_id, operation;
