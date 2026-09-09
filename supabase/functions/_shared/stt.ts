// Speech-to-text: one place that decides how audio gets transcribed.
//
// Transcription was previously hardcoded in three separate functions across two
// vendors — ElevenLabs Scribe for the social paths, the Lovable gateway for
// voice notes — so changing a model meant editing several files and shipping a
// deploy, and there was no failover between the two bills we were already
// paying.
//
// Provider and model are now configuration. The default is the Lovable gateway,
// because that key already exists and it keeps transcription on one bill; set
// STT_PROVIDER=elevenlabs to switch, or STT_FALLBACK_PROVIDER to fail over.
//
// Nothing here decides *whether* to transcribe. That is the expensive question
// and it belongs to the caller: prefer captions, prefer the cache, and only
// reach for a model when there is genuinely no cheaper source.

export type SttProvider = "lovable" | "elevenlabs";

export type SttConfig = {
  provider: SttProvider;
  model: string;
  /** Tried only if the primary provider errors. Null disables failover. */
  fallbackProvider: SttProvider | null;
  fallbackModel: string;
  /** Hard ceiling on submitted audio, whatever the plan allows. */
  maxBytes: number;
  /** Hard ceiling on audio duration in seconds, when we know it up front. */
  maxDurationSeconds: number;
};

const DEFAULTS = {
  provider: "lovable" as SttProvider,
  // Cheap transcription-specific model rather than a general chat model.
  lovableModel: "openai/gpt-4o-mini-transcribe",
  elevenLabsModel: "scribe_v2",
  maxBytes: 50 * 1024 * 1024,
  maxDurationSeconds: 90 * 60,
};

const asProvider = (v: string | undefined): SttProvider | null =>
  v === "lovable" || v === "elevenlabs" ? v : null;

const asPositiveInt = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

/**
 * Resolve configuration from an environment map.
 *
 * Pure and env-injected rather than reading Deno.env directly, so the resolution
 * rules are testable and a typo in a variable name degrades to the documented
 * default instead of an undefined model string reaching a provider.
 */
export function resolveSttConfig(env: Record<string, string | undefined>): SttConfig {
  const provider = asProvider(env.STT_PROVIDER) ?? DEFAULTS.provider;
  const fallbackProvider = asProvider(env.STT_FALLBACK_PROVIDER);

  const modelFor = (p: SttProvider): string =>
    p === "elevenlabs"
      ? env.STT_ELEVENLABS_MODEL || DEFAULTS.elevenLabsModel
      : env.STT_LOVABLE_MODEL || DEFAULTS.lovableModel;

  return {
    provider,
    model: modelFor(provider),
    // Failing over to the provider we just failed on is not failover.
    fallbackProvider: fallbackProvider && fallbackProvider !== provider ? fallbackProvider : null,
    fallbackModel: fallbackProvider ? modelFor(fallbackProvider) : "",
    maxBytes: asPositiveInt(env.STT_MAX_BYTES, DEFAULTS.maxBytes),
    maxDurationSeconds: asPositiveInt(env.STT_MAX_DURATION_SECONDS, DEFAULTS.maxDurationSeconds),
  };
}

export type SttResult = {
  text: string;
  provider: SttProvider;
  model: string;
  /** True when the primary provider failed and the fallback produced this. */
  usedFallback: boolean;
};

/**
 * Failure codes that are ours to fix rather than the customer's to pay for.
 *
 * Deliberately excludes audio_too_large and audio_too_long: those are a true
 * statement about what was submitted. A bad key, a rejected container or a
 * provider outage is not — charging for it, and then rate limiting the retry,
 * is how a broken feature becomes a billing complaint.
 */
export const OUR_FAULT = new Set([
  "provider_auth",
  "provider_rejected_media",
  "provider_unavailable",
  "stt_failed",
]);

export class SttError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

/** Reasons to refuse before spending anything. */
export function checkAudioLimits(
  cfg: SttConfig,
  byteLength: number,
  durationSeconds: number | null,
): SttError | null {
  if (byteLength <= 0) return new SttError("No audio to transcribe", "empty_audio");
  if (byteLength > cfg.maxBytes) {
    return new SttError(
      `That file is too large to transcribe (limit ${Math.floor(cfg.maxBytes / 1024 / 1024)}MB).`,
      "audio_too_large",
    );
  }
  if (durationSeconds !== null && durationSeconds > cfg.maxDurationSeconds) {
    return new SttError(
      `That's too long to transcribe (limit ${Math.floor(cfg.maxDurationSeconds / 60)} minutes).`,
      "audio_too_long",
    );
  }
  return null;
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

/**
 * A filename the provider will accept.
 *
 * Both endpoints are multipart file uploads, and both infer the container from
 * the filename extension as well as the content type. We were uploading every
 * reel as a file literally named "audio" with no extension, which at least one
 * of them rejects outright — a plausible cause of the provider_error that
 * every Instagram transcription in production has returned.
 */
const EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
};

export function filenameFor(mime: string): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  return `audio.${EXT[base] ?? "mp4"}`;
}

/**
 * Turn a failed provider response into an error that says what to do about it.
 *
 * This used to collapse everything that was not a 429 into `provider_error`,
 * and never read the body. That is the state the Instagram path has been stuck
 * in: five failures on record, all logged as `provider_error`, with no way to
 * tell a wrong API key from a rejected file format without redeploying to add a
 * log line. The status code already distinguishes them, so use it.
 */
export function codeForStatus(status: number): string {
  if (status === 401 || status === 403) return "provider_auth";
  if (status === 413) return "audio_too_large";
  if (status === 400 || status === 415 || status === 422) return "provider_rejected_media";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "provider_error";
}

async function providerFailure(label: string, resp: Response): Promise<SttError> {
  // Read the body before anything else — it is the only place a provider
  // explains itself, and it is gone once the response is discarded.
  let detail = "";
  try {
    detail = (await resp.text()).slice(0, 600);
  } catch { /* a body we cannot read is not worth failing differently over */ }
  console.error(`${label} STT failed`, resp.status, detail);

  return new SttError(`${label} STT failed (${resp.status})`, codeForStatus(resp.status));
}

async function callLovable(
  bytes: Uint8Array,
  mime: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const fd = new FormData();
  fd.append("file", new File([toBlobPart(bytes)], filenameFor(mime), { type: mime }));
  fd.append("model", model);

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!resp.ok) throw await providerFailure("Lovable", resp);
  const data = (await resp.json()) as { text?: string };
  return (data.text ?? "").trim();
}

async function callElevenLabs(
  bytes: Uint8Array,
  mime: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const fd = new FormData();
  fd.append("file", new Blob([toBlobPart(bytes)], { type: mime }), filenameFor(mime));
  fd.append("model_id", model);

  const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd,
  });
  if (!resp.ok) throw await providerFailure("ElevenLabs Scribe", resp);
  const data = (await resp.json()) as { text?: string };
  return (data.text ?? "").trim();
}

function keyFor(provider: SttProvider, env: Record<string, string | undefined>): string | null {
  return (provider === "elevenlabs" ? env.ELEVENLABS_API_KEY : env.LOVABLE_API_KEY) ?? null;
}

/** Transcribe audio with the configured provider, failing over if configured. */
export async function transcribeAudio(
  bytes: Uint8Array,
  mime: string,
  env: Record<string, string | undefined>,
): Promise<SttResult> {
  const cfg = resolveSttConfig(env);

  const limit = checkAudioLimits(cfg, bytes.byteLength, null);
  if (limit) throw limit;

  const run = async (provider: SttProvider, model: string): Promise<string> => {
    const key = keyFor(provider, env);
    if (!key) throw new SttError(`${provider} STT is not configured`, "not_configured");
    return provider === "elevenlabs"
      ? await callElevenLabs(bytes, mime, model, key)
      : await callLovable(bytes, mime, model, key);
  };

  try {
    const text = await run(cfg.provider, cfg.model);
    if (!text) throw new SttError("Transcription came back empty", "empty_transcript");
    return { text, provider: cfg.provider, model: cfg.model, usedFallback: false };
  } catch (primary) {
    if (!cfg.fallbackProvider) throw primary;
    console.error(
      "stt: primary provider failed, trying fallback",
      cfg.provider,
      primary instanceof Error ? primary.message : primary,
    );
    const text = await run(cfg.fallbackProvider, cfg.fallbackModel);
    if (!text) throw new SttError("Transcription came back empty", "empty_transcript");
    return {
      text,
      provider: cfg.fallbackProvider,
      model: cfg.fallbackModel,
      usedFallback: true,
    };
  }
}
