-- Purpose: make the Library work at ten thousand items, not just at ten.
--
-- Search runs ILIKE '%term%' across title, raw_note, extracted_text and
-- ai_summary. Without a trigram index every one of those is a sequential scan
-- over the customer's whole table, and transcripts are large. Folder, favorite
-- and search listings had no supporting index at all.
--
-- Additive and idempotent; indexes only, no data or schema change. Rollback:
-- DROP the indexes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ILIKE '%…%' can only use a GIN trigram index.
CREATE INDEX IF NOT EXISTS ideas_title_trgm_idx
  ON public.ideas USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ideas_raw_note_trgm_idx
  ON public.ideas USING gin (raw_note gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ideas_ai_summary_trgm_idx
  ON public.ideas USING gin (ai_summary gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ideas_extracted_text_trgm_idx
  ON public.ideas USING gin (extracted_text gin_trgm_ops);

-- Tag filtering.
CREATE INDEX IF NOT EXISTS ideas_tags_idx
  ON public.ideas USING gin (tags);

-- The two most common list scopes, restricted to live rows so the index stays
-- small as the trash fills up. (The user + updated_at ordering index lives in
-- the trash migration.)
CREATE INDEX IF NOT EXISTS ideas_user_folder_idx
  ON public.ideas (user_id, folder_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ideas_user_favorites_idx
  ON public.ideas (user_id, updated_at DESC)
  WHERE deleted_at IS NULL AND is_favorite;

-- Pinned items float to the top of every list.
CREATE INDEX IF NOT EXISTS ideas_user_pinned_idx
  ON public.ideas (user_id, pinned_at DESC)
  WHERE deleted_at IS NULL AND pinned_at IS NOT NULL;

-- Full-text search, for when retrieval moves off ILIKE onto ranked search.
-- Created now so the column is populated and backfilled before it is needed.
ALTER TABLE public.ideas
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(ai_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(raw_note, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(extracted_text, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS ideas_search_vector_idx
  ON public.ideas USING gin (search_vector);
