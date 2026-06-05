
CREATE TABLE public.idea_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES public.ideas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  remind_at timestamptz NOT NULL,
  notify_push boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT false,
  label text,
  fired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.idea_reminders TO authenticated;
GRANT ALL ON public.idea_reminders TO service_role;

ALTER TABLE public.idea_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own idea reminders" ON public.idea_reminders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own idea reminders" ON public.idea_reminders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own idea reminders" ON public.idea_reminders
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own idea reminders" ON public.idea_reminders
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_idea_reminders_due
  ON public.idea_reminders (remind_at)
  WHERE fired_at IS NULL;
CREATE INDEX idx_idea_reminders_idea ON public.idea_reminders (idea_id);
CREATE INDEX idx_idea_reminders_user ON public.idea_reminders (user_id);

CREATE TRIGGER update_idea_reminders_updated_at
  BEFORE UPDATE ON public.idea_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
