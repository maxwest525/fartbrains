CREATE TYPE public.idea_priority AS ENUM ('none', 'low', 'medium', 'high');

ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS priority public.idea_priority NOT NULL DEFAULT 'none';