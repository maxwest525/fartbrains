-- Purpose: one durable job queue for all build-time work.
--
-- Ingest, checksum, chunk, embed, compile and repo scanning happen off the
-- request path, on a runner. That runner needs something to claim work from
-- that survives its own death: a job that vanishes when a process is killed is
-- not durable.
--
-- `transcription_jobs` already exists and solved this for one operation. This
-- generalises it rather than adding a second queue per operation.
--
-- Leasing, not locking: a runner claims a job for a bounded period. If it dies,
-- the lease expires and another runner picks the job up. No cleanup process is
-- required for a crashed worker.
--
-- Rollback: DROP TABLE public.jobs and the two functions.

CREATE TABLE IF NOT EXISTS public.jobs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          text NOT NULL,     -- ingest_source | chunk_version | embed_chunks | scan_repo | compile_source
  -- Everything the handler needs. Never credentials: the runner resolves those
  -- from its own environment.
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- queued | running | completed | failed | canceled
  status        text NOT NULL DEFAULT 'queued',
  priority      integer NOT NULL DEFAULT 100,   -- lower runs first
  attempts      integer NOT NULL DEFAULT 0,
  max_attempts  integer NOT NULL DEFAULT 3,     -- spec §19: three, unless stated otherwise
  -- Lease. Held by one runner until it expires.
  leased_by     text,
  leased_until  timestamptz,
  run_after     timestamptz NOT NULL DEFAULT now(),  -- backoff between attempts
  -- Chains work without a scheduler: ingest queues chunk, chunk queues embed.
  parent_job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  -- Deduplication. Two identical enqueues collapse into one job.
  idempotency_key text,
  result        jsonb,
  error_code    text,
  error_detail  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  CONSTRAINT jobs_attempts_sane CHECK (attempts >= 0 AND max_attempts > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_idempotency_idx
  ON public.jobs (user_id, kind, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status <> 'failed';

-- The claim query's index: runnable work, best candidate first.
CREATE INDEX IF NOT EXISTS jobs_claimable_idx
  ON public.jobs (priority, run_after)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS jobs_user_idx ON public.jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_parent_idx ON public.jobs (parent_job_id);
-- Finding leases that expired because a runner died.
CREATE INDEX IF NOT EXISTS jobs_expired_lease_idx
  ON public.jobs (leased_until) WHERE status = 'running';

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;

-- Customers watch their own jobs so the UI can show real progress. Only the
-- runner, through the service role, creates or advances them.
DROP POLICY IF EXISTS "Users read own jobs" ON public.jobs;
CREATE POLICY "Users read own jobs" ON public.jobs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_job()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS jobs_touch ON public.jobs;
CREATE TRIGGER jobs_touch BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_job();

-- Claim one job atomically.
--
-- SKIP LOCKED is what makes several runners safe on one queue: each skips rows
-- another is already claiming rather than blocking behind them. A job whose
-- lease has expired is claimable again, so a runner that dies mid-job releases
-- its work without anyone having to notice.
CREATE OR REPLACE FUNCTION public.claim_job(
  p_runner       text,
  p_kinds        text[] DEFAULT NULL,
  p_lease_seconds integer DEFAULT 300
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  j public.jobs;
BEGIN
  SELECT * INTO j FROM public.jobs
   WHERE (status = 'queued' AND run_after <= now())
      OR (status = 'running' AND leased_until < now())
     AND (p_kinds IS NULL OR kind = ANY(p_kinds))
   ORDER BY priority, run_after
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  UPDATE public.jobs
     SET status = 'running',
         attempts = attempts + 1,
         leased_by = p_runner,
         leased_until = now() + make_interval(secs => p_lease_seconds)
   WHERE id = j.id
   RETURNING * INTO j;

  RETURN j;
END;
$$;

-- Finish a job. On failure, retry with exponential backoff until max_attempts,
-- then fail permanently. Retrying forever hides a real defect behind noise.
CREATE OR REPLACE FUNCTION public.finish_job(
  p_job_id      uuid,
  p_status      text,          -- completed | failed
  p_result      jsonb DEFAULT NULL,
  p_error_code  text DEFAULT NULL,
  p_error_detail text DEFAULT NULL
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  j public.jobs;
BEGIN
  SELECT * INTO j FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'job % not found', p_job_id; END IF;

  IF p_status = 'completed' THEN
    UPDATE public.jobs
       SET status = 'completed', result = p_result, completed_at = now(),
           leased_by = NULL, leased_until = NULL, error_code = NULL, error_detail = NULL
     WHERE id = p_job_id RETURNING * INTO j;

  ELSIF j.attempts < j.max_attempts THEN
    -- Backoff: 2^attempts minutes, so a failing dependency is not hammered.
    UPDATE public.jobs
       SET status = 'queued',
           run_after = now() + make_interval(mins => power(2, j.attempts)::int),
           leased_by = NULL, leased_until = NULL,
           error_code = p_error_code, error_detail = p_error_detail
     WHERE id = p_job_id RETURNING * INTO j;

  ELSE
    UPDATE public.jobs
       SET status = 'failed', completed_at = now(),
           leased_by = NULL, leased_until = NULL,
           error_code = p_error_code, error_detail = p_error_detail
     WHERE id = p_job_id RETURNING * INTO j;
  END IF;

  RETURN j;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_job(text, text[], integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_job(uuid, text, jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_job(text, text[], integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_job(uuid, text, jsonb, text, text) TO service_role;

COMMENT ON TABLE public.jobs IS
  'Durable queue for build-time work. Claimed by lease so a dead runner releases its job automatically.';
