CREATE TABLE public.idea_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  title text,
  description text,
  kind text NOT NULL DEFAULT 'other',
  source text NOT NULL DEFAULT 'firecrawl',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idea_references_idea_id_idx ON public.idea_references(idea_id);
CREATE INDEX idea_references_user_id_idx ON public.idea_references(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_references TO authenticated;
GRANT ALL ON public.idea_references TO service_role;

ALTER TABLE public.idea_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own idea references"
  ON public.idea_references FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own idea references"
  ON public.idea_references FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own idea references"
  ON public.idea_references FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own idea references"
  ON public.idea_references FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);