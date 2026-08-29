CREATE TABLE public.user_instructions (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  general TEXT NOT NULL DEFAULT '',
  capture TEXT NOT NULL DEFAULT '',
  summarize TEXT NOT NULL DEFAULT '',
  tagging TEXT NOT NULL DEFAULT '',
  organizing TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_instructions TO authenticated;
GRANT ALL ON public.user_instructions TO service_role;

ALTER TABLE public.user_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own instructions"
  ON public.user_instructions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_instructions_updated_at
  BEFORE UPDATE ON public.user_instructions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();