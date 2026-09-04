-- Purpose: stop paying to transcribe the same public video twice, and stop
-- long transcriptions dying on the edge-function timeout.
--
-- Two tables.
--
-- 1. transcript_cache — transcripts of PUBLIC media, keyed by platform + the
--    platform's own id (YouTube video id, Instagram shortcode). Transcription is
--    by far the most expensive operation in the product, and two customers
--    saving the same viral reel currently pay for it twice.
--
--    PRIVACY: this table deliberately has NO user_id and NO reference to any
--    idea. It caches the transcript of publicly available media only — never an
--    uploaded voice note, never anything a customer authored. Without a user
--    column it cannot be used to work out who saved what.
--
-- 2. transcription_jobs — durable per-customer job records so a transcription
--    that outlives the request can be polled, retried and reported on, instead
--    of vanishing when the function times out.
--
-- Additive and idempotent. Rollback: DROP both tables.

CREATE TABLE IF NOT EXISTS public.transcript_cache (
  platform      text NOT NULL,           -- 'youtube' | 'instagram'
  external_id   text NOT NULL,           -- video id / shortcode
  transcript    text NOT NULL,
  title         text,
  author        text,
  duration_seconds integer,
  -- 'captions' costs nothing; 'stt' means we paid a model for it.
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

ALTER TABLE public.transcript_cache ENABLE ROW LEVEL SECURITY;
-- No policies at all: only the service role, inside edge functions, touches
-- this. Customers reach transcripts through their own ideas, never here.

CREATE TABLE IF NOT EXISTS public.transcription_jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text NOT NULL,           -- 'youtube' | 'instagram' | 'audio'
  source_url    text,
  external_id   text,
  -- queued | processing | completed | failed | canceled
  status        text NOT NULL DEFAULT 'queued',
  -- 'cache' | 'captions' | 'stt' — how the transcript was actually obtained
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

ALTER TABLE public.transcription_jobs ENABLE ROW LEVEL SECURITY;

-- Customers may watch their own jobs. Only edge functions, via the service
-- role, create or advance them.
DROP POLICY IF EXISTS "Users read own transcription jobs" ON public.transcription_jobs;
CREATE POLICY "Users read own transcription jobs" ON public.transcription_jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_transcription_job()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS transcription_jobs_touch ON public.transcription_jobs;
CREATE TRIGGER transcription_jobs_touch
  BEFORE UPDATE ON public.transcription_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_transcription_job();
