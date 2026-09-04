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

async function callLovable(
  bytes: Uint8Array,
  mime: string,
  model: string,
  apiKey: string,
): Promise<string> {
  const fd = new FormData();
  fd.append("file", new File([toBlobPart(bytes)], "audio", { type: mime }));
  fd.append("model", model);

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!resp.ok) {
    throw new SttError(
      `Lovable STT failed (${resp.status})`,
      resp.status === 429 ? "rate_limited" : "provider_error",
    );
  }
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
  fd.append("file", new Blob([toBlobPart(bytes)], { type: mime }), "audio");
  fd.append("model_id", model);

  const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd,
  });
  if (!resp.ok) {
    throw new SttError(
      `ElevenLabs Scribe failed (${resp.status})`,
      resp.status === 429 ? "rate_limited" : "provider_error",
    );
  }
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
