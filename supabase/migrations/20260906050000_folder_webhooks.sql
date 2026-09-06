-- Purpose: let a customer forward captures to an endpoint they choose.
--
-- Replaces a hardcoded integration. One folder used to POST its ideas to a
-- specific private Cloud Run service belonging to the operator, for every
-- account that happened to use a folder of that name. This is the same idea
-- with the destination handed back to the person whose notes they are.
--
-- One webhook per folder, off unless a URL is set. The secret is generated
-- server-side and shown to the owner so their receiver can verify signatures;
-- it is stored in plaintext because HMAC signing needs the key itself, and it
-- is readable only by its owner under RLS.
--
-- delivery bookkeeping is on the row rather than a log table: what a person
-- needs is "is this working", which is the last attempt, not a history.
--
-- Rollback: DROP TABLE public.folder_webhooks.

CREATE TABLE IF NOT EXISTS public.folder_webhooks (
  folder_id        uuid PRIMARY KEY REFERENCES public.folders(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url              text NOT NULL,
  secret           text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  enabled          boolean NOT NULL DEFAULT true,
  include_note     boolean NOT NULL DEFAULT true,
  include_summary  boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- Last attempt only. "Is this working" is a current-state question.
  last_status      integer,
  last_error       text,
  last_delivered_at timestamptz,
  delivery_count   integer NOT NULL DEFAULT 0,
  -- Only http(s) is ever fetched; the edge function re-checks, but a value
  -- that could never be valid should not be storable in the first place.
  CONSTRAINT folder_webhooks_url_scheme CHECK (url ~* '^https?://'),
  CONSTRAINT folder_webhooks_url_length CHECK (length(url) BETWEEN 8 AND 2048)
);

CREATE INDEX IF NOT EXISTS folder_webhooks_user_idx ON public.folder_webhooks (user_id);

ALTER TABLE public.folder_webhooks ENABLE ROW LEVEL SECURITY;

-- The folder must be the caller's own, not merely the row's user_id: without
-- the EXISTS check someone could attach a webhook to another account's folder
-- by claiming the row, and every capture in it would be forwarded to them.
DROP POLICY IF EXISTS "Owners view own folder webhooks" ON public.folder_webhooks;
CREATE POLICY "Owners view own folder webhooks" ON public.folder_webhooks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners create own folder webhooks" ON public.folder_webhooks;
CREATE POLICY "Owners create own folder webhooks" ON public.folder_webhooks
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = folder_id AND f.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners update own folder webhooks" ON public.folder_webhooks;
CREATE POLICY "Owners update own folder webhooks" ON public.folder_webhooks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.folders f
      WHERE f.id = folder_id AND f.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners delete own folder webhooks" ON public.folder_webhooks;
CREATE POLICY "Owners delete own folder webhooks" ON public.folder_webhooks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS folder_webhooks_set_updated_at ON public.folder_webhooks;
CREATE TRIGGER folder_webhooks_set_updated_at
  BEFORE UPDATE ON public.folder_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.folder_webhooks IS
  'Per-folder outbound webhook chosen by the folder owner. Delivery is server-side and SSRF-checked; payloads are HMAC-signed with `secret`.';
COMMENT ON COLUMN public.folder_webhooks.secret IS
  'HMAC-SHA256 signing key. Plaintext by necessity — signing needs the key — and readable only by its owner under RLS.';
