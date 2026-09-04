-- Purpose: actually run the Trash retention policy.
--
-- purge_expired_trash() exists but nothing calls it, so "deleted items are
-- removed after 30 days" is currently a claim the product does not keep: the
-- rows sit in the table forever. The privacy policy says deleted data is
-- removed, which makes this a promise, not a nicety.
--
-- Schedules a nightly run with pg_cron. Idempotent: the job is unscheduled
-- first, so re-running never leaves two copies double-purging.
--
-- Rollback: SELECT cron.unschedule('purge-expired-trash');

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  -- cron.unschedule throws if the job does not exist, so look first.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-trash') THEN
    PERFORM cron.unschedule('purge-expired-trash');
  END IF;

  PERFORM cron.schedule(
    'purge-expired-trash',
    '17 3 * * *',  -- 03:17 UTC daily; off the hour so it does not contend
                   -- with every other cron job on the instance.
    $job$ SELECT public.purge_expired_trash(30); $job$
  );
END $$;

COMMENT ON FUNCTION public.purge_expired_trash(integer) IS
  'Permanently removes ideas trashed more than N days ago. Scheduled nightly as cron job purge-expired-trash. Derived rows (references, reminders, chats, shares) cascade.';
