
-- 1) Pin search_path on SECURITY DEFINER helpers that were missing it.
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;

-- 2) Restrict EXECUTE on SECURITY DEFINER functions to service_role only.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated;',
                   r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role;',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 3) Storage: drop broad public listing on idea-audio; replace with a
--    narrow "user can list their own folder" policy. Public URL playback
--    still works because the bucket itself is public.
DROP POLICY IF EXISTS "Public read idea audio" ON storage.objects;

CREATE POLICY "Users can list own audio"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'idea-audio'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
