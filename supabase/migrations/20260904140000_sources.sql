-- Purpose: the canonical knowledge substrate — spec §3.1, §7.1, §8.
--
-- Today an idea is a mutable row, and AI summaries and tags are written onto it
-- as accepted truth. We want the opposite: a model proposes, and a claim cites
-- an exact range of an immutable version. That needs a version to cite, which
-- is what this migration creates.
--
-- SHAPE
--   project        a thing the customer's brain is attached to (repo, folder,
--                  initiative). Optional — a loose capture belongs to no project.
--   source         stable identity for one piece of material.
--   source_version append-only, content-addressed body. Corrections create a new
--                  version; nothing is ever rewritten.
--   source_chunk   deterministic segment of a version. The unit that gets
--                  embedded and retrieved, so retrieval cites a range rather
--                  than a whole document.
--   evidence_span  exact character range a claim must resolve to.
--
-- These are canonical going forward. `ideas` continues to serve the current UI
-- and is backfilled in as version 1, but it is a legacy projection, not the
-- record of truth. New capture writes a source and derives the idea row.
--
-- BUILD TIME vs RUN TIME
--   Writing these rows is build-time work: ingest, checksum, chunk, embed,
--   compile. It runs in a local runner, CI, or a scheduled job — wherever the
--   source actually lives, which for a customer's folder or repo is their own
--   machine. Nothing here needs an always-on server.
--   Reading them is run time: retrieval over chunks, cheap and request-shaped.
--   That split is why the writer is the service role and the reader is the
--   customer's own RLS-scoped session.
--
-- Bodies are stored inline today with `body_ref` reserved for object storage
-- (§16.1). Large transcripts do not belong in a Postgres text column forever,
-- and having the column now means moving them later is a backfill rather than
-- a schema change.
--
-- Rollback: DROP the five tables. `ideas` is untouched throughout.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- digest() for content addressing

-- A project is the customer's own repo, folder or initiative. It is NOT a
-- shared workspace: projects belong to exactly one account, and nothing here
-- introduces members, roles or invitations.
CREATE TABLE IF NOT EXISTS public.projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  kind         text NOT NULL DEFAULT 'initiative',  -- repo | folder | initiative
  -- Sanitized remote identity. A local identifier PROPOSES a link; only a
  -- scoped provider authorization confirms the live resource (§8.3).
  remote_url   text,
  default_branch text,
  last_scanned_at timestamptz,
  archived_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projects_user_idx
  ON public.projects (user_id, updated_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id  uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  kind        text NOT NULL,           -- capture | url | transcript | file | repo_file | email
  origin_url  text,
  title       text,
  -- Transitional link to the legacy row this was backfilled from. New sources
  -- leave it null; it exists so the two models can be reconciled, not because
  -- `ideas` owns anything.
  legacy_idea_id uuid REFERENCES public.ideas(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sources_user_idx    ON public.sources (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sources_project_idx ON public.sources (project_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS sources_legacy_idea_idx
  ON public.sources (legacy_idea_id) WHERE legacy_idea_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.source_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id      uuid NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version        integer NOT NULL,
  -- Exactly one of body / body_ref is set. Inline today; object storage later.
  body           text,
  body_ref       text,
  content_sha256 text NOT NULL,
  byte_length    integer NOT NULL,
  adapter         text,
  adapter_version text,
  warnings       jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, version),
  -- Identical bytes for the same source is the same version: re-ingest is a
  -- no-op, not a duplicate.
  UNIQUE (source_id, content_sha256),
  CONSTRAINT source_versions_body_present CHECK (body IS NOT NULL OR body_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS source_versions_user_idx   ON public.source_versions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS source_versions_latest_idx ON public.source_versions (source_id, version DESC);

-- Chunks are the retrieval and embedding unit. Deterministic segmentation runs
-- before any model call (§9.1), so the same version always chunks identically
-- and a recompile is comparable to its predecessor.
CREATE TABLE IF NOT EXISTS public.source_chunks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_version_id uuid NOT NULL REFERENCES public.source_versions(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ordinal           integer NOT NULL,
  start_offset      integer NOT NULL,
  end_offset        integer NOT NULL,
  content           text NOT NULL,
  -- Full-text over the chunk, so exact retrieval (§16.1's first path) works
  -- at chunk granularity rather than whole-document.
  search_vector     tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  -- Embedding lands here once pgvector is enabled and a model is chosen; the
  -- model and dimensions travel with the row so lineage survives a model change.
  embedding_model   text,
  embedded_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_version_id, ordinal),
  CONSTRAINT source_chunks_range CHECK (end_offset > start_offset AND start_offset >= 0)
);

CREATE INDEX IF NOT EXISTS source_chunks_version_idx ON public.source_chunks (source_version_id, ordinal);
CREATE INDEX IF NOT EXISTS source_chunks_fts_idx     ON public.source_chunks USING gin (search_vector);
CREATE INDEX IF NOT EXISTS source_chunks_unembedded_idx
  ON public.source_chunks (user_id) WHERE embedded_at IS NULL;

CREATE TABLE IF NOT EXISTS public.evidence_spans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_version_id uuid NOT NULL REFERENCES public.source_versions(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_offset      integer NOT NULL,
  end_offset        integer NOT NULL,
  excerpt           text NOT NULL,
  locator           jsonb,          -- heading path, timestamp, file:line — adapter specific
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_spans_range CHECK (end_offset > start_offset AND start_offset >= 0)
);

CREATE INDEX IF NOT EXISTS evidence_spans_version_idx ON public.evidence_spans (source_version_id, start_offset);
CREATE INDEX IF NOT EXISTS evidence_spans_user_idx    ON public.evidence_spans (user_id);

-- Ownership. Policies plus the grants that make them exercisable — policies
-- alone are not enough, as applying the earlier migrations showed.
ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_chunks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_spans  ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT ON public.sources, public.source_versions, public.source_chunks, public.evidence_spans TO authenticated;
GRANT ALL ON public.projects, public.sources, public.source_versions, public.source_chunks, public.evidence_spans TO service_role;

DROP POLICY IF EXISTS "Users manage own projects" ON public.projects;
CREATE POLICY "Users manage own projects" ON public.projects
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own sources" ON public.sources;
CREATE POLICY "Users read own sources" ON public.sources
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own source versions" ON public.source_versions;
CREATE POLICY "Users read own source versions" ON public.source_versions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own source chunks" ON public.source_chunks;
CREATE POLICY "Users read own source chunks" ON public.source_chunks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own evidence spans" ON public.evidence_spans;
CREATE POLICY "Users read own evidence spans" ON public.evidence_spans
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Sources, versions, chunks and spans are READ-ONLY to the customer's session:
-- they are produced at build time by the runner, through the service role. An
-- immutable source a browser can UPDATE is not immutable. `projects` is
-- writable, because attaching and naming a project is a run-time action.

CREATE OR REPLACE FUNCTION public.touch_updated_at_generic()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS projects_touch ON public.projects;
CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS sources_touch ON public.sources;
CREATE TRIGGER sources_touch BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- Backfill so the canonical model describes the existing corpus from day one
-- instead of starting empty. Idempotent; safe to re-run.
INSERT INTO public.sources (user_id, kind, origin_url, title, legacy_idea_id, created_at)
SELECT i.user_id,
       CASE i.source_type
         WHEN 'webpage'    THEN 'url'
         WHEN 'transcript' THEN 'transcript'
         WHEN 'audio'      THEN 'transcript'
         ELSE 'capture'
       END,
       i.source_url, i.title, i.id, i.created_at
FROM public.ideas i
WHERE i.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.sources s WHERE s.legacy_idea_id = i.id);

INSERT INTO public.source_versions
  (source_id, user_id, version, body, content_sha256, byte_length, adapter, adapter_version, created_at)
SELECT s.id, s.user_id, 1, b.txt,
       encode(digest(b.txt, 'sha256'), 'hex'),
       octet_length(b.txt),
       'backfill', '1', s.created_at
FROM public.sources s
JOIN public.ideas i ON i.id = s.legacy_idea_id
CROSS JOIN LATERAL (
  SELECT COALESCE(NULLIF(i.extracted_text, ''), NULLIF(i.raw_note, ''), i.title, '') AS txt
) b
WHERE b.txt <> ''
  AND NOT EXISTS (SELECT 1 FROM public.source_versions v WHERE v.source_id = s.id);

COMMENT ON TABLE public.projects IS
  'A repo, folder or initiative the account attaches its brain to. Single-owner: never a shared workspace.';
COMMENT ON TABLE public.sources IS
  'Stable source identity. Content lives in source_versions, which are append-only.';
COMMENT ON TABLE public.source_versions IS
  'Immutable content-addressed source content. Corrections create a new version; nothing is rewritten.';
COMMENT ON TABLE public.source_chunks IS
  'Deterministic segments of a version. The unit that is embedded and retrieved.';
COMMENT ON TABLE public.evidence_spans IS
  'Exact character range within a source version. Every factual claim must cite one.';
