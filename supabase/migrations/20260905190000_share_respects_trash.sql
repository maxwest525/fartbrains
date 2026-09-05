-- Purpose: a shared link must stop working when the owner trashes the note.
--
-- resolve_idea_share() was written before Trash existed (20260903130000, two
-- migrations before 20260903150000_trash.sql) and never learned about it. It
-- checks revoked_at and expires_at, then joins public.ideas with no filter on
-- deleted_at — so a note the owner moved to Trash kept serving to anyone
-- holding the link, for the full 30 days until the purge job removed the row.
--
-- Deleting is how most people revoke. Someone who trashes a note has decided
-- it should not be readable, and the product answered that by continuing to
-- publish it. That the link eventually died on its own is not consent.
--
-- Two changes:
--   * a trashed idea returns zero rows, the same as unknown, revoked and
--     expired, so a holder still cannot tell a wrong token from a dead one;
--   * the idea is fetched BEFORE access_count is incremented, so a link that
--     resolves to nothing no longer records a view the owner never granted.
--     Previously the counter rose on every hit to a trashed note, which is
--     exactly the evidence an owner would use to decide whether to worry.
--
-- Additive and idempotent. Rollback: restore the previous definition from
-- 20260903130000_idea_shares.sql.

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
  i public.ideas%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.idea_shares WHERE token_hash = p_token_hash;

  -- Unknown, revoked and expired all return zero rows, so a caller cannot tell
  -- a wrong token from a dead one and cannot enumerate live shares.
  IF NOT FOUND OR s.revoked_at IS NOT NULL
     OR (s.expires_at IS NOT NULL AND s.expires_at <= now()) THEN
    RETURN;
  END IF;

  -- A trashed note is not shareable. Same silent zero rows: adding a distinct
  -- "deleted" response would tell a link holder that the note existed and that
  -- the owner has since removed it.
  SELECT * INTO i FROM public.ideas WHERE id = s.idea_id;
  IF NOT FOUND OR i.deleted_at IS NOT NULL THEN
    RETURN;
  END IF;

  -- Counted only once the link has actually resolved, so access_count means
  -- "someone read this note" rather than "someone tried".
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
    s.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_idea_share(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_idea_share(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_idea_share(text) TO service_role;

COMMENT ON FUNCTION public.resolve_idea_share(text) IS
  'Public share resolver. Returns at most one row, only the sections the owner opted into, and nothing at all for an unknown, revoked, expired or trashed share. Service role only.';
