-- Purpose: make search actually rank.
--
-- ideas.search_vector has existed since the search-index migration, weighted
-- title(A) / summary+note(B) / transcript(C), with a GIN index. Nothing has
-- ever queried it: search_ideas does `ilike '%term%'` across four columns and
-- orders by updated_at. That means no ranking, no stemming, and no way for a
-- title hit to beat a passing mention buried in a transcript.
--
-- PostgREST can filter on a tsvector but cannot order by ts_rank, so ranked
-- search needs a function.
--
-- Hybrid on purpose. Full-text search does not do prefix matching, so a user
-- typing "instag" gets nothing for "Instagram" — and typing half a word you
-- half-remember is exactly how people search their own notes. So: FTS matches
-- rank first, ILIKE matches come after, one query, one round trip.
--
-- SECURITY INVOKER (the default for SQL functions, stated here because it is
-- load-bearing): the function runs as the caller, so RLS applies and one
-- customer can never search another's vault. Never make this DEFINER.
--
-- Rollback: DROP FUNCTION public.search_ideas(text, uuid, text, boolean, int);

CREATE OR REPLACE FUNCTION public.search_ideas(
  q              text,
  folder         uuid    DEFAULT NULL,
  tag            text    DEFAULT NULL,
  favorites_only boolean DEFAULT false,
  max_results    int     DEFAULT 15
)
RETURNS SETOF public.ideas
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH needle AS (
    SELECT
      -- websearch_to_tsquery never raises on user input, unlike to_tsquery.
      websearch_to_tsquery('english', coalesce(q, '')) AS tsq,
      '%' || replace(replace(coalesce(q, ''), '\', '\\'), '%', '\%') || '%' AS like_q,
      length(btrim(coalesce(q, ''))) > 0 AS has_q
  )
  SELECT i.*
  FROM public.ideas i, needle n
  WHERE i.deleted_at IS NULL
    AND (folder IS NULL OR i.folder_id = folder)
    AND (tag IS NULL OR i.tags @> ARRAY[tag])
    AND (NOT favorites_only OR i.is_favorite)
    AND (
      -- No query at all is a valid call: it means "the most recent".
      NOT n.has_q
      OR i.search_vector @@ n.tsq
      OR i.title ILIKE n.like_q
      OR i.raw_note ILIKE n.like_q
      OR i.ai_summary ILIKE n.like_q
      OR i.extracted_text ILIKE n.like_q
    )
  ORDER BY
    -- ts_rank is 0 for rows that only matched ILIKE, so real term matches
    -- sort above substring matches without a second query.
    ts_rank(i.search_vector, n.tsq) DESC,
    i.updated_at DESC
  LIMIT greatest(1, least(coalesce(max_results, 15), 50));
$$;

COMMENT ON FUNCTION public.search_ideas(text, uuid, text, boolean, int) IS
  'Ranked search over the caller''s own ideas. Full-text first, substring second, so a half-remembered word still finds the note. SECURITY INVOKER: RLS scopes it to the caller.';

-- A policy without a grant is not exercisable; the same is true of a function.
GRANT EXECUTE ON FUNCTION public.search_ideas(text, uuid, text, boolean, int) TO authenticated;
