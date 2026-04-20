
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS remind_at         timestamptz,
  ADD COLUMN IF NOT EXISTS notify_push       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_fired_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ideas_remind_at
  ON public.ideas (remind_at)
  WHERE remind_at IS NOT NULL AND reminder_fired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_folders_remind_at
  ON public.folders (remind_at)
  WHERE remind_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own push subs"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own push subs"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own push subs"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions (user_id);
