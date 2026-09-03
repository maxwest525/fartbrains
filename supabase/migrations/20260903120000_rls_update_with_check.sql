-- Purpose: close a cross-tenant write hole in row level security.
--
-- Every user-owned table defined its UPDATE policy as
--     FOR UPDATE USING (auth.uid() = user_id)
-- with no WITH CHECK clause. In Postgres, USING gates which existing rows may be
-- updated; WITH CHECK gates what the row may look like afterwards. Without it a
-- customer can update a row they legitimately own and set user_id to another
-- account, pushing their row into a stranger's private brain (and losing it from
-- their own). profiles already had the correct pair and is left alone.
--
-- Additive and idempotent: policies are dropped by name and recreated with the
-- same predicate plus the missing WITH CHECK. No columns or data are touched, so
-- rollback is simply recreating the previous (weaker) policies.

-- ideas
DROP POLICY IF EXISTS "Users update own ideas" ON public.ideas;
CREATE POLICY "Users update own ideas" ON public.ideas
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- folders
DROP POLICY IF EXISTS "Users update own folders" ON public.folders;
CREATE POLICY "Users update own folders" ON public.folders
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- calendar_events
DROP POLICY IF EXISTS "Users update own calendar events" ON public.calendar_events;
CREATE POLICY "Users update own calendar events" ON public.calendar_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- idea_reminders
DROP POLICY IF EXISTS "Users update own idea reminders" ON public.idea_reminders;
CREATE POLICY "Users update own idea reminders" ON public.idea_reminders
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- todos
DROP POLICY IF EXISTS "Owners can update their todos" ON public.todos;
CREATE POLICY "Owners can update their todos" ON public.todos
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- idea_references
DROP POLICY IF EXISTS "Users update own idea references" ON public.idea_references;
CREATE POLICY "Users update own idea references" ON public.idea_references
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- event_gifts
DROP POLICY IF EXISTS "Users update own gifts" ON public.event_gifts;
CREATE POLICY "Users update own gifts" ON public.event_gifts
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- idea_chats: confirm the same shape if an UPDATE policy exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'idea_chats'
      AND p.polcmd = 'w' AND p.polwithcheck IS NULL
  ) THEN
    RAISE NOTICE 'idea_chats has an UPDATE policy without WITH CHECK; review it.';
  END IF;
END $$;
