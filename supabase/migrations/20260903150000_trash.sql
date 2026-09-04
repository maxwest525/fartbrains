-- Purpose: stop deletion from destroying customer data instantly.
--
-- Deleting an idea ran DELETE immediately with no undo. One mis-tap and a
-- captured thought is gone forever, which is not acceptable in a product whose
-- entire promise is "put anything in and find it later".
--
-- Adds a soft-delete column. Deletion moves an idea to Trash; the customer can
-- undo straight away, restore later, permanently delete, or empty the trash.
-- A documented 30-day retention window is enforced by purge_expired_trash(),
-- which the owner should schedule daily (pg_cron or a scheduled function).
--
-- Additive, idempotent, and non-destructive: existing rows get NULL, i.e. "not
-- deleted". Rollback: DROP the column and the function.

ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.ideas.deleted_at IS
  'Soft delete. NULL = live. Set = in Trash; purged after 30 days.';

-- Every list query filters on deleted_at, so index the live set.
CREATE INDEX IF NOT EXISTS ideas_user_live_idx
  ON public.ideas (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ideas_user_trash_idx
  ON public.ideas (user_id, deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- Retention. Permanently removes ideas trashed more than 30 days ago; the
-- foreign keys on idea_references, idea_reminders, idea_chats and idea_shares
-- cascade, so derived rows go with the source.
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

-- Trashing an idea must also kill any share links pointing at it: a recipient
-- must not keep reading something the owner deleted.
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
