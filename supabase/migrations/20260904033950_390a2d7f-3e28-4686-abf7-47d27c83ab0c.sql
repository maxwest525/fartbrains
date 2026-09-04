CREATE TABLE public.user_drafts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  composer text NOT NULL DEFAULT '',
  jot text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_drafts TO authenticated;
GRANT ALL ON public.user_drafts TO service_role;

ALTER TABLE public.user_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own drafts"
ON public.user_drafts FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_drafts_updated_at
BEFORE UPDATE ON public.user_drafts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();