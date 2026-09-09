import { ALLOWED_ORIGIN } from "../_shared/cors.ts";
import { guardAiRequest } from "../_shared/ai-guard.ts";
import { costFrom } from "../_shared/ai-cost.ts";

/**
 * OCR and object detection for a captured image.
 *
 * A large share of what people capture is a screenshot: a pricing table, a
 * slide, a comment thread, a whiteboard. Until now that arrived in the vault as
 * an opaque blob — nothing to transcribe, nothing to tag, nothing to search.
 * This reads the picture.
 *
 * It is one model call, not two. Gemini Flash is multimodal, so asking for the
 * text and the objects in the same pass costs one round trip instead of
 * wiring a separate OCR engine (Tesseract, Vision API) alongside a separate
 * detector. It is also the same gateway and the same key as every other AI
 * call in the app, so there is no new vendor and no new secret.
 *
 * Output is deliberately shaped like the rest of the pipeline: `text` feeds
 * summarize/auto-tag exactly as a transcript would, and `labels` are already
 * in tag form.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMPTY = { text: "", labels: [] as string[], description: "", hasText: false };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Data URLs and https URLs both go straight to the gateway; anything else is
 *  a path we have not agreed to fetch on the user's behalf. */
const usableImage = (u: unknown): u is string =>
  typeof u === "string" &&
  (u.startsWith("data:image/") || u.startsWith("https://")) &&
  u.length < 8_000_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _guard = await guardAiRequest(req, corsHeaders, "analyze_image");
  if ("response" in _guard) return _guard.response;

  try {
    const { imageUrl } = await req.json();
    if (!usableImage(imageUrl)) return json({ ...EMPTY, error: "bad image" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const system = `You read images for a capture app. Return ONLY a compact JSON object:
{"text":"","labels":["laptop","whiteboard"],"description":"","hasText":true}

- "text": every readable word in the image, transcribed verbatim, preserving
  line breaks and reading order. Do not summarize, correct, translate, or add
  commentary. If there is no legible text, use "".
- "labels": 2-8 things actually visible — objects, people, UI surfaces, places.
  Lowercase, 1-2 words, kebab-case if multi-word. Only what is there; never
  guess at what the image is "about".
- "description": one sentence, <= 160 chars, describing the image to someone
  who cannot see it.
- "hasText": true only if "text" is non-empty and legible.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Flash, not Pro: OCR and labelling are not reasoning problems, and
        // this runs on every image capture.
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Read this image." },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      console.error("analyze-image gateway error:", resp.status, await resp.text());
      // A failed read must not fail the capture — the image is still saved.
      return json(EMPTY);
    }

    const data = await resp.json();
    // The gateway reports tokens on every response; record them. Without this
    // the cost columns stay null and there is no way to price anything.
    await _guard.record({ success: true, provider: "lovable", ...costFrom(data, "google/gemini-3-flash-preview") });
    const raw = data?.choices?.[0]?.message?.content ?? "{}";

    let text = "";
    let labels: string[] = [];
    let description = "";
    try {
      const p = JSON.parse(raw);
      if (typeof p?.text === "string") text = p.text.slice(0, 20_000).trim();
      if (typeof p?.description === "string") description = p.description.slice(0, 240).trim();
      if (Array.isArray(p?.labels)) {
        labels = [
          ...new Set(
            p.labels
              .filter((l: unknown) => typeof l === "string")
              .map((l: string) =>
                l.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 32),
              )
              .filter((l: string) => l.length >= 2),
          ),
        ].slice(0, 8);
      }
    } catch (_e) { /* fall through to the empty shape */ }

    return json({ text, labels, description, hasText: text.length > 0 });
  } catch (e) {
    console.error("analyze-image error:", e);
    return json(EMPTY);
  }
});
