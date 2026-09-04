-- 1. RLS: add missing WITH CHECK on UPDATE policies
DROP POLICY IF EXISTS "Users update own ideas" ON public.ideas;
CREATE POLICY "Users update own ideas" ON public.ideas
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own folders" ON public.folders;
CREATE POLICY "Users update own folders" ON public.folders
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own calendar events" ON public.calendar_events;
CREATE POLICY "Users update own calendar events" ON public.calendar_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own idea reminders" ON public.idea_reminders;
CREATE POLICY "Users update own idea reminders" ON public.idea_reminders
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can update their todos" ON public.todos;
CREATE POLICY "Owners can update their todos" ON public.todos
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own idea references" ON public.idea_references;
CREATE POLICY "Users update own idea references" ON public.idea_references
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own gifts" ON public.event_gifts;
CREATE POLICY "Users update own gifts" ON public.event_gifts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Revocable read-only idea shares
CREATE TABLE IF NOT EXISTS public.idea_shares (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idea_id          uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  token_hash       text NOT NULL UNIQUE,
  include_note     boolean NOT NULL DEFAULT true,
  include_summary  boolean NOT NULL DEFAULT true,
  include_refs     boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz,
  revoked_at       timestamptz,
  last_accessed_at timestamptz,
  access_count     integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idea_shares_user_idx ON public.idea_shares (user_id);
CREATE INDEX IF NOT EXISTS idea_shares_idea_idx ON public.idea_shares (idea_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_shares TO authenticated;
GRANT ALL ON public.idea_shares TO service_role;

ALTER TABLE public.idea_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view own shares" ON public.idea_shares;
CREATE POLICY "Owners view own shares" ON public.idea_shares
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners create own shares" ON public.idea_shares;
CREATE POLICY "Owners create own shares" ON public.idea_shares
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.ideas i WHERE i.id = idea_id AND i.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Owners update own shares" ON public.idea_shares;
CREATE POLICY "Owners update own shares" ON public.idea_shares
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners delete own shares" ON public.idea_shares;
CREATE POLICY "Owners delete own shares" ON public.idea_shares
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.resolve_idea_share(p_token_hash text)
RETURNS TABLE (
  title       text,
  note        text,
  summary     text,
  refs        jsonb,
  shared_at   timestamptz,
  expires_at  timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.idea_shares%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.idea_shares WHERE token_hash = p_token_hash;

  IF NOT FOUND OR s.revoked_at IS NOT NULL
     OR (s.expires_at IS NOT NULL AND s.expires_at <= now()) THEN
    RETURN;
  END IF;

  UPDATE public.idea_shares
     SET access_count = access_count + 1, last_accessed_at = now()
   WHERE id = s.id;

  RETURN QUERY
  SELECT
    i.title,
    CASE WHEN s.include_note    THEN i.raw_note   ELSE NULL END,
    CASE WHEN s.include_summary THEN i.ai_summary ELSE NULL END,
    CASE WHEN s.include_refs THEN (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('title', r.title, 'url', r.url)), '[]'::jsonb)
      FROM public.idea_references r WHERE r.idea_id = i.id
    ) ELSE '[]'::jsonb END,
    s.created_at,
    s.expires_at
  FROM public.ideas i
  WHERE i.id = s.idea_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_idea_share(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_idea_share(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_idea_share(text) TO service_role;

-- 3. AI usage accounting (metadata only)
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
  decision       text NOT NULL DEFAULT 'allowed',
  request_id     text,
  idea_id        uuid,
  plan           text NOT NULL DEFAULT 'free',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_time_idx
  ON public.ai_usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_user_op_time_idx
  ON public.ai_usage_events (user_id, operation, created_at DESC);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own AI usage" ON public.ai_usage_events;
CREATE POLICY "Users read own AI usage" ON public.ai_usage_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

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

GRANT SELECT ON public.ai_usage_current_month TO authenticated;
GRANT SELECT ON public.ai_usage_current_month TO service_role;

-- 4. Trash (soft delete) for ideas
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.ideas.deleted_at IS
  'Soft delete. NULL = live. Set = in Trash; purged after 30 days.';

CREATE INDEX IF NOT EXISTS ideas_user_live_idx
  ON public.ideas (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ideas_user_trash_idx
  ON public.ideas (user_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.purge_expired_trash(p_retention_days integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.ideas
   WHERE deleted_at IS NOT NULL
     AND deleted_at < now() - make_interval(days => p_retention_days);
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_trash(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_trash(integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_trash(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.revoke_shares_on_trash()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.idea_shares
       SET revoked_at = now()
     WHERE idea_id = NEW.id AND revoked_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ideas_revoke_shares_on_trash ON public.ideas;
CREATE TRIGGER ideas_revoke_shares_on_trash
  AFTER UPDATE OF deleted_at ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.revoke_shares_on_trash();

-- 5. Billing
CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id    text UNIQUE,
  stripe_subscription_id text UNIQUE,
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

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own subscription" ON public.subscriptions;
CREATE POLICY "Users read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.billing_events (
  id           text PRIMARY KEY,
  type         text NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'processed',
  error        text
);

CREATE INDEX IF NOT EXISTS billing_events_user_idx
  ON public.billing_events (user_id, processed_at DESC);

GRANT ALL ON public.billing_events TO service_role;

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_subscription_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS subscriptions_touch_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_touch_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_subscription_updated_at();

-- 6. Search indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS ideas_title_trgm_idx
  ON public.ideas USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ideas_raw_note_trgm_idx
  ON public.ideas USING gin (raw_note gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ideas_ai_summary_trgm_idx
  ON public.ideas USING gin (ai_summary gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ideas_extracted_text_trgm_idx
  ON public.ideas USING gin (extracted_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ideas_tags_idx
  ON public.ideas USING gin (tags);

CREATE INDEX IF NOT EXISTS ideas_user_folder_idx
  ON public.ideas (user_id, folder_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ideas_user_favorites_idx
  ON public.ideas (user_id, updated_at DESC)
  WHERE deleted_at IS NULL AND is_favorite;

CREATE INDEX IF NOT EXISTS ideas_user_pinned_idx
  ON public.ideas (user_id, pinned_at DESC)
  WHERE deleted_at IS NULL AND pinned_at IS NOT NULL;

ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(ai_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(raw_note, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(extracted_text, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS ideas_search_vector_idx
  ON public.ideas USING gin (search_vector);

-- 7. Transcript cache + durable transcription jobs
CREATE TABLE IF NOT EXISTS public.transcript_cache (
  platform      text NOT NULL,
  external_id   text NOT NULL,
  transcript    text NOT NULL,
  title         text,
  author        text,
  duration_seconds integer,
  source        text NOT NULL DEFAULT 'stt',
  provider      text,
  model         text,
  hit_count     integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, external_id)
);

CREATE INDEX IF NOT EXISTS transcript_cache_last_used_idx
  ON public.transcript_cache (last_used_at DESC);

GRANT ALL ON public.transcript_cache TO service_role;

ALTER TABLE public.transcript_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.transcription_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  source_url    text,
  external_id   text,
  status        text NOT NULL DEFAULT 'queued',
  resolved_from text,
  transcript    text,
  title         text,
  author        text,
  thumbnail     text,
  duration_seconds integer,
  error_code    text,
  attempts      integer NOT NULL DEFAULT 0,
  usage_event_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS transcription_jobs_user_idx
  ON public.transcription_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS transcription_jobs_active_idx
  ON public.transcription_jobs (user_id, status)
  WHERE status IN ('queued', 'processing');

GRANT SELECT ON public.transcription_jobs TO authenticated;
GRANT ALL ON public.transcription_jobs TO service_role;

ALTER TABLE public.transcription_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own transcription jobs" ON public.transcription_jobs;
CREATE POLICY "Users read own transcription jobs" ON public.transcription_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_transcription_job()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS transcription_jobs_touch ON public.transcription_jobs;
CREATE TRIGGER transcription_jobs_touch
  BEFORE UPDATE ON public.transcription_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_transcription_job();