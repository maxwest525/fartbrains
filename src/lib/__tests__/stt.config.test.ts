import { describe, it, expect } from "vitest";
import {
  checkAudioLimits,
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
