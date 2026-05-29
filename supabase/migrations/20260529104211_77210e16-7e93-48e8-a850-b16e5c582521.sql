CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('birthday','holiday','floating_holiday','custom')),
  month INTEGER CHECK (month BETWEEN 1 AND 12),
  day INTEGER CHECK (day BETWEEN 1 AND 31),
  floating_key TEXT CHECK (floating_key IN ('mothers_day','fathers_day','thanksgiving')),
  birth_year INTEGER,
  emoji TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_date_or_floating CHECK (
    (month IS NOT NULL AND day IS NOT NULL) OR floating_key IS NOT NULL
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own calendar events"
  ON public.calendar_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own calendar events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own calendar events"
  ON public.calendar_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own calendar events"
  ON public.calendar_events FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_calendar_events_user ON public.calendar_events(user_id);
CREATE INDEX idx_calendar_events_month_day ON public.calendar_events(month, day);

CREATE TRIGGER calendar_events_set_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();