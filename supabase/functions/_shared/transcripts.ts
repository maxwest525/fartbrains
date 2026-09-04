// Transcript cache + durable job records.
//
// Transcription is the most expensive thing the product does, so the cheapest
// transcription is the one we do not run. Order of preference, always:
//   1. the cache      — free
//   2. captions       — near-free
//   3. a speech model — the thing we are trying to avoid

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

export type Platform = "youtube" | "instagram";
export type ResolvedFrom = "cache" | "captions" | "stt";

export type CachedTranscript = {
  transcript: string;
  title: string | null;
  author: string | null;
  durationSeconds: number | null;
  source: string;
};

const svc = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

/**
 * Cache key for public media.
 *
 * Normalised so the same video reached by a different URL — youtu.be, extra
 * query parameters, a different case — is one cache entry and not several.
 * Returns null when there is no stable public id, which is the signal that this
 * content must never be cached.
 */
export function cacheKey(platform: Platform, externalId: string | null | undefined): {
  platform: Platform;
  external_id: string;
} | null {
  const id = (externalId ?? "").trim();
  if (!id) return null;
  // Platform ids are case-sensitive; only the surrounding noise is normalised.
  return { platform, external_id: id };
}

export async function lookupTranscript(
  platform: Platform,
  externalId: string,
): Promise<CachedTranscript | null> {
  const key = cacheKey(platform, externalId);
  if (!key) return null;

  const client = svc();
  const { data, error } = await client
    .from("transcript_cache")
    .select("transcript, title, author, duration_seconds, source, hit_count")
    .eq("platform", key.platform)
    .eq("external_id", key.external_id)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    transcript: string;
    title: string | null;
    author: string | null;
    duration_seconds: number | null;
    source: string;
    hit_count: number;
  };

  // Best-effort accounting; a failed counter must never fail a cache hit.
  void client
    .from("transcript_cache")
    .update({ hit_count: row.hit_count + 1, last_used_at: new Date().toISOString() })
    .eq("platform", key.platform)
    .eq("external_id", key.external_id)
    .then(undefined, () => {});

  return {
    transcript: row.transcript,
    title: row.title,
    author: row.author,
    durationSeconds: row.duration_seconds,
    source: row.source,
  };
}

/**
 * Store a transcript of PUBLIC media. Never call this with an uploaded voice
 * note or anything a customer authored — the cache has no owner and is shared.
 */
export async function storeTranscript(
  platform: Platform,
  externalId: string,
  value: CachedTranscript & { provider?: string; model?: string },
): Promise<void> {
  const key = cacheKey(platform, externalId);
  if (!key || !value.transcript.trim()) return;

  const { error } = await svc()
    .from("transcript_cache")
    .upsert(
      {
        ...key,
        transcript: value.transcript,
        title: value.title,
        author: value.author,
        duration_seconds: value.durationSeconds,
        source: value.source,
        provider: value.provider ?? null,
        model: value.model ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "platform,external_id" },
    );
  if (error) console.error("transcripts: cache write failed", error.message);
}

// --- durable jobs ---------------------------------------------------------

export type JobKind = "youtube" | "instagram" | "audio";

export async function createJob(
  userId: string,
  kind: JobKind,
  sourceUrl: string | null,
  externalId: string | null,
): Promise<string | null> {
  const { data, error } = await svc()
    .from("transcription_jobs")
    .insert({ user_id: userId, kind, source_url: sourceUrl, external_id: externalId, status: "processing", attempts: 1 })
    .select("id")
    .single();
  if (error) {
    console.error("transcripts: job create failed", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

export async function completeJob(
  jobId: string | null,
  resolvedFrom: ResolvedFrom,
  result: {
    transcript: string;
    title?: string | null;
    author?: string | null;
    thumbnail?: string | null;
    durationSeconds?: number | null;
  },
): Promise<void> {
  if (!jobId) return;
  const { error } = await svc()
    .from("transcription_jobs")
    .update({
      status: "completed",
      resolved_from: resolvedFrom,
      transcript: result.transcript,
      title: result.title ?? null,
      author: result.author ?? null,
      thumbnail: result.thumbnail ?? null,
      duration_seconds: result.durationSeconds ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (error) console.error("transcripts: job complete failed", error.message);
}

export async function failJob(jobId: string | null, errorCode: string): Promise<void> {
  if (!jobId) return;
  const { error } = await svc()
    .from("transcription_jobs")
    .update({ status: "failed", error_code: errorCode, completed_at: new Date().toISOString() })
    .eq("id", jobId);
  if (error) console.error("transcripts: job fail failed", error.message);
}
