
CREATE TABLE public.idea_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  idea_id UUID NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idea_chats_idea_id_created_idx ON public.idea_chats(idea_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_chats TO authenticated;
GRANT ALL ON public.idea_chats TO service_role;

ALTER TABLE public.idea_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own idea chats"
  ON public.idea_chats FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
