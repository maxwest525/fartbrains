-- Two-account row level security test.
--
-- This is the check that proves the product's core promise: one customer
-- cannot reach another customer's brain. Everything else in the security
-- review is reasoning; this is evidence.
--
-- HOW TO RUN
--   1. Create two real accounts through the app (sign up twice). Do not use
--      service-role or the SQL editor's default role — both bypass RLS and
--      will make every test below pass regardless of whether the policies work.
--   2. Put their user ids in the two settings below.
--   3. Sign in as A and capture one idea, one folder and one todo, so there is
--      something for B to fail to reach.
--   4. Run this whole script in the Supabase SQL editor.
--
-- Every test raises an exception on failure, so the script either completes
-- silently (pass) or stops at the first breach with a named error.

\set user_a 'PASTE-USER-A-UUID-HERE'
\set user_b 'PASTE-USER-B-UUID-HERE'

BEGIN;

-- Become user B: RLS reads auth.uid() out of the JWT claims, so setting the
-- claims is what makes the following statements run *as* B.
CREATE OR REPLACE FUNCTION pg_temp.become(p_user uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
END $$;

CREATE OR REPLACE FUNCTION pg_temp.expect_zero(p_label text, p_count bigint)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_count <> 0 THEN
    RAISE EXCEPTION 'RLS BREACH — %: expected 0 rows, got %', p_label, p_count;
  END IF;
  RAISE NOTICE 'pass: %', p_label;
END $$;

DO $$
DECLARE
  a uuid := :'user_a';
  b uuid := :'user_b';
  n bigint;
BEGIN
  IF a = b THEN RAISE EXCEPTION 'user_a and user_b must be different accounts'; END IF;

  PERFORM pg_temp.become(b);

  -- ---------- READS ----------
  SELECT count(*) INTO n FROM public.ideas            WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s ideas', n);

  SELECT count(*) INTO n FROM public.folders          WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s folders', n);

  SELECT count(*) INTO n FROM public.todos            WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s todos', n);

  SELECT count(*) INTO n FROM public.idea_chats       WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s AI chats', n);

  SELECT count(*) INTO n FROM public.idea_references  WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s references', n);

  SELECT count(*) INTO n FROM public.idea_reminders   WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s reminders', n);

  SELECT count(*) INTO n FROM public.calendar_events  WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s calendar', n);

  SELECT count(*) INTO n FROM public.user_instructions WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s personal instructions', n);

  SELECT count(*) INTO n FROM public.idea_shares      WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s share links', n);

  SELECT count(*) INTO n FROM public.ai_usage_events  WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s AI usage', n);

  SELECT count(*) INTO n FROM public.subscriptions    WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s subscription', n);

  SELECT count(*) INTO n FROM public.transcription_jobs WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s transcription jobs', n);

  SELECT count(*) INTO n FROM public.user_drafts      WHERE user_id = a;
  PERFORM pg_temp.expect_zero('B cannot read A''s drafts', n);

  -- Backend-only tables: no policies at all, so an end user sees nothing.
  SELECT count(*) INTO n FROM public.transcript_cache;
  PERFORM pg_temp.expect_zero('B cannot read the transcript cache', n);

  SELECT count(*) INTO n FROM public.billing_events;
  PERFORM pg_temp.expect_zero('B cannot read the billing event log', n);

  -- ---------- WRITES ----------
  UPDATE public.ideas SET title = 'OWNED BY B' WHERE user_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.expect_zero('B cannot update A''s ideas', n);

  DELETE FROM public.ideas WHERE user_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.expect_zero('B cannot delete A''s ideas', n);

  UPDATE public.folders SET name = 'OWNED BY B' WHERE user_id = a;
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM pg_temp.expect_zero('B cannot update A''s folders', n);

  -- ---------- THE WITH CHECK HOLE ----------
  -- The specific bug the rls_update_with_check migration closed: B updates a
  -- row B legitimately owns, reassigning it to A. USING alone allows this;
  -- WITH CHECK is what refuses it.
  BEGIN
    UPDATE public.ideas SET user_id = a WHERE user_id = b;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE EXCEPTION 'RLS BREACH — B pushed % of its own ideas into A''s account', n;
    END IF;
    RAISE NOTICE 'pass: B cannot reassign its own ideas to A (no rows changed)';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    -- Being refused outright is the better outcome.
    RAISE NOTICE 'pass: B cannot reassign its own ideas to A (refused by policy)';
  END;

  -- B must not be able to forge a row owned by A either.
  BEGIN
    INSERT INTO public.ideas (user_id, title, source_type)
    VALUES (a, 'forged by B', 'manual');
    RAISE EXCEPTION 'RLS BREACH — B inserted a row owned by A';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'pass: B cannot insert a row owned by A';
  END;

  -- B must not be able to write billing state for itself.
  BEGIN
    INSERT INTO public.subscriptions (user_id, status)
    VALUES (b, 'active')
    ON CONFLICT (user_id) DO UPDATE SET status = 'active';
    RAISE EXCEPTION 'RLS BREACH — B granted itself an active subscription';
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    RAISE NOTICE 'pass: B cannot write its own subscription status';
  END;

  RAISE NOTICE '--- all isolation tests passed ---';
END $$;

-- Nothing above should have changed anything, but roll back regardless so a
-- partial pass cannot leave test damage behind.
ROLLBACK;
