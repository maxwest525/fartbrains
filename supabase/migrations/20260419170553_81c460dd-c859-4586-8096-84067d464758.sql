-- Source type enum
CREATE TYPE public.idea_source_type AS ENUM ('manual', 'webpage', 'transcript', 'audio');

-- Folders
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own folders" ON public.folders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own folders" ON public.folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own folders" ON public.folders
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own folders" ON public.folders
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_folders_user ON public.folders(user_id);

-- Ideas
CREATE TABLE public.ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  raw_note TEXT,
  source_url TEXT,
  source_type public.idea_source_type NOT NULL DEFAULT 'manual',
  extracted_text TEXT,
  ai_summary TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ideas" ON public.ideas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ideas" ON public.ideas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ideas" ON public.ideas
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own ideas" ON public.ideas
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_ideas_user ON public.ideas(user_id);
CREATE INDEX idx_ideas_folder ON public.ideas(folder_id);
CREATE INDEX idx_ideas_favorite ON public.ideas(user_id, is_favorite);
CREATE INDEX idx_ideas_created ON public.ideas(user_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_ideas_updated_at
  BEFORE UPDATE ON public.ideas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();