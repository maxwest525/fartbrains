ALTER TABLE public.ideas ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX idx_ideas_pinned_at ON public.ideas(user_id, pinned_at DESC NULLS LAST);