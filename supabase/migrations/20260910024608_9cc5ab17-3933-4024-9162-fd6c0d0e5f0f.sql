TRUNCATE cron.job_run_details;
TRUNCATE net._http_response;

CREATE OR REPLACE FUNCTION public.purge_internal_job_logs(p_retention_days integer DEFAULT 7)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
BEGIN
  DELETE FROM cron.job_run_details
   WHERE start_time < now() - make_interval(days => p_retention_days);
  DELETE FROM net._http_response
   WHERE created < now() - make_interval(days => p_retention_days);
END;
$$;

REVOKE ALL ON FUNCTION public.purge_internal_job_logs(integer) FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule('purge-internal-job-logs')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-internal-job-logs');

SELECT cron.schedule('purge-internal-job-logs', '43 3 * * *', $$SELECT public.purge_internal_job_logs(7);$$);

SELECT cron.alter_job(jobid, schedule => '*/5 * * * *')
  FROM cron.job WHERE jobname = 'dispatch-reminders-every-minute';