import { describe, it, expect } from "vitest";
import {
  OUR_FAULT,
  checkAudioLimits,
  codeForStatus,
  filenameFor,
  resolveSttConfig,
} from "../../../supabase/functions/_shared/stt";

const MB = 1024 * 1024;

describe("STT provider and model resolution", () => {
  it("defaults to the Lovable gateway, so one key and one bill", () => {
    const cfg = resolveSttConfig({});
    expect(cfg.provider).toBe("lovable");
    expect(cfg.model).toBe("openai/gpt-4o-mini-transcribe");
    expect(cfg.fallbackProvider).toBeNull();
  });

  it("switches provider from config without a code change", () => {
    const cfg = resolveSttConfig({ STT_PROVIDER: "elevenlabs" });
    expect(cfg.provider).toBe("elevenlabs");
    expect(cfg.model).toBe("scribe_v2");
  });

  it("lets the model be overridden per provider", () => {
    expect(resolveSttConfig({ STT_LOVABLE_MODEL: "some/other-model" }).model)
      .toBe("some/other-model");
    expect(
      resolveSttConfig({ STT_PROVIDER: "elevenlabs", STT_ELEVENLABS_MODEL: "scribe_v3" }).model,
    ).toBe("scribe_v3");
  });

  it("falls back to the documented default on an unknown provider name", () => {
    // A typo must not send an undefined model string to a provider.
    const cfg = resolveSttConfig({ STT_PROVIDER: "whisper-local" });
    expect(cfg.provider).toBe("lovable");
    expect(cfg.model).toBeTruthy();
  });

  it("configures failover to the other provider", () => {
    const cfg = resolveSttConfig({
      STT_PROVIDER: "lovable",
      STT_FALLBACK_PROVIDER: "elevenlabs",
    });
    expect(cfg.fallbackProvider).toBe("elevenlabs");
    expect(cfg.fallbackModel).toBe("scribe_v2");
  });

  it("refuses to 'fail over' to the provider that just failed", () => {
    const cfg = resolveSttConfig({
      STT_PROVIDER: "lovable",
      STT_FALLBACK_PROVIDER: "lovable",
    });
    expect(cfg.fallbackProvider).toBeNull();
  });
});

describe("cost caps", () => {
  it("ships with a 50MB / 90-minute ceiling", () => {
    const cfg = resolveSttConfig({});
    expect(cfg.maxBytes).toBe(50 * MB);
    expect(cfg.maxDurationSeconds).toBe(90 * 60);
  });

  it("takes tighter caps from config", () => {
    const cfg = resolveSttConfig({
      STT_MAX_BYTES: String(10 * MB),
      STT_MAX_DURATION_SECONDS: "600",
    });
    expect(cfg.maxBytes).toBe(10 * MB);
    expect(cfg.maxDurationSeconds).toBe(600);
  });

  it("ignores junk and zero caps rather than disabling the ceiling", () => {
    for (const bad of ["", "0", "-5", "lots", "NaN"]) {
      expect(resolveSttConfig({ STT_MAX_BYTES: bad }).maxBytes).toBe(50 * MB);
    }
  });
});

describe("refusing work before paying for it", () => {
  const cfg = resolveSttConfig({ STT_MAX_BYTES: String(5 * MB), STT_MAX_DURATION_SECONDS: "60" });

  it("accepts audio inside the limits", () => {
    expect(checkAudioLimits(cfg, 1 * MB, 30)).toBeNull();
  });

  it("rejects an oversized file", () => {
    const err = checkAudioLimits(cfg, 6 * MB, null);
    expect(err?.code).toBe("audio_too_large");
    expect(err?.message).toMatch(/5MB/);
  });

  it("rejects audio that is too long when we know the duration", () => {
    const err = checkAudioLimits(cfg, 1 * MB, 120);
    expect(err?.code).toBe("audio_too_long");
    expect(err?.message).toMatch(/1 minute/);
  });

  it("allows an unknown duration through, since only size is certain", () => {
    expect(checkAudioLimits(cfg, 1 * MB, null)).toBeNull();
  });

  it("rejects empty audio", () => {
    expect(checkAudioLimits(cfg, 0, null)?.code).toBe("empty_audio");
  });
});

describe("filenameFor", () => {
  it("gives the upload a real extension, which is what providers read", () => {
    expect(filenameFor("video/mp4")).toBe("audio.mp4");
    expect(filenameFor("audio/mpeg")).toBe("audio.mp3");
    expect(filenameFor("audio/x-m4a")).toBe("audio.m4a");
    expect(filenameFor("video/quicktime")).toBe("audio.mov");
  });

  it("ignores codec parameters on the content type", () => {
    expect(filenameFor('video/mp4; codecs="avc1.42E01E"')).toBe("audio.mp4");
  });

  it("is case insensitive", () => {
    expect(filenameFor("VIDEO/MP4")).toBe("audio.mp4");
  });

  it("falls back to mp4 rather than sending no extension at all", () => {
    // Sending a file literally named "audio" is what the old code did, and is
    // the most likely cause of the provider_error on every Instagram capture.
    expect(filenameFor("application/octet-stream")).toBe("audio.mp4");
    expect(filenameFor("")).toBe("audio.mp4");
  });
});

describe("codeForStatus", () => {
  it("separates a bad key from a rejected file", () => {
    expect(codeForStatus(401)).toBe("provider_auth");
    expect(codeForStatus(403)).toBe("provider_auth");
    expect(codeForStatus(400)).toBe("provider_rejected_media");
    expect(codeForStatus(415)).toBe("provider_rejected_media");
    expect(codeForStatus(422)).toBe("provider_rejected_media");
  });

  it("keeps rate limiting and size distinguishable", () => {
    expect(codeForStatus(429)).toBe("rate_limited");
    expect(codeForStatus(413)).toBe("audio_too_large");
  });

  it("calls a 5xx an outage rather than a generic error", () => {
    expect(codeForStatus(500)).toBe("provider_unavailable");
    expect(codeForStatus(503)).toBe("provider_unavailable");
  });

  it("still has a fallback for anything unexpected", () => {
    expect(codeForStatus(418)).toBe("provider_error");
  });
});

describe("OUR_FAULT", () => {
  it("covers the failures the customer should not be charged for", () => {
    for (const code of ["provider_auth", "provider_rejected_media", "provider_unavailable", "stt_failed"]) {
      expect(OUR_FAULT.has(code)).toBe(true);
    }
  });

  it("does not excuse audio that genuinely broke the limits", () => {
    expect(OUR_FAULT.has("audio_too_large")).toBe(false);
    expect(OUR_FAULT.has("audio_too_long")).toBe(false);
    // Rate limiting is a real signal about usage, not a provider defect.
    expect(OUR_FAULT.has("rate_limited")).toBe(false);
  });
});
