
CREATE TABLE public.event_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text,
  price numeric(10,2),
  notes text,
  purchased boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX event_gifts_event_id_idx ON public.event_gifts(event_id);
CREATE INDEX event_gifts_user_id_idx ON public.event_gifts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_gifts TO authenticated;
GRANT ALL ON public.event_gifts TO service_role;
ALTER TABLE public.event_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own gifts" ON public.event_gifts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own gifts" ON public.event_gifts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own gifts" ON public.event_gifts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own gifts" ON public.event_gifts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER set_event_gifts_updated_at BEFORE UPDATE ON public.event_gifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
