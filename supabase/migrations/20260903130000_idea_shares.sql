-- Purpose: real, revocable, read-only sharing of ONE idea with a friend.
--
-- Replaces the previous "brainstorm with a friend" link, which was just the
-- owner's own authenticated URL (`/?idea=<uuid>&collab=1`) — the recipient could
-- not open it, and the idea UUID was being treated as if it were authorization.
--
-- Design:
--   * The secret token never touches the database. The owner's browser generates
--     32 random bytes, stores only the SHA-256 hex of it here, and puts the raw
--     token in the link. A database dump therefore does not yield working links.
--   * NO anonymous policy is added to public.ideas. Public resolution goes
--     through resolve_idea_share(), a narrow SECURITY DEFINER function that
--     returns only the fields the owner explicitly chose to include.
--   * Owners may expire, revoke and regenerate; access is counted so the owner
--     can see whether the link was opened.
--
-- Additive and idempotent. Rollback: DROP the function and the table.

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

-- Public resolution. Takes the SHA-256 hex of the raw token (the caller never
-- passes the token itself into SQL), returns at most one row, and exposes only
-- title plus the sections the owner opted into. It deliberately returns nothing
-- about the owner: no email, no user id, no folder, no tags, no chats, no
-- reminders, no embeddings, no other ideas.
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

  -- Unknown, revoked and expired all return zero rows, so a caller cannot tell
  -- a wrong token from a dead one and cannot enumerate live shares.
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

-- Only the service role may call it; the public page goes through the
-- rate-limited resolve-share edge function rather than straight to PostgREST.
REVOKE ALL ON FUNCTION public.resolve_idea_share(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_idea_share(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_idea_share(text) TO service_role;
