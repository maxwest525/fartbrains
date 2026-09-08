import { supabase } from "@/integrations/supabase/client";

/**
 * OCR and object detection for captured images.
 *
 * The `analyze-image` edge function does the reading; this module decides what
 * a capture should become once it has been read. Both halves are pure and
 * tested, because the interesting decisions are here, not in the model call:
 * a screenshot of a pricing table should become searchable text, while a photo
 * of a dog should become a description and some tags — and the difference is
 * just how much legible text came back.
 */

export type ImageAnalysis = {
  /** Verbatim text found in the image. Empty when there is none. */
  text: string;
  /** Things visible in the image, already in tag form. */
  labels: string[];
  /** One sentence for someone who cannot see it. */
  description: string;
  hasText: boolean;
};

export const EMPTY_ANALYSIS: ImageAnalysis = {
  text: "",
  labels: [],
  description: "",
  hasText: false,
};

/**
 * Below this we treat the image as a picture rather than a document. A stray
 * watermark, a timestamp, or a username in the corner is not the content —
 * filing that as the note body gives you a vault full of notes called "9:41".
 */
const DOCUMENT_MIN_CHARS = 40;

export type ImageKind = "document" | "picture";

export const classifyImage = (a: ImageAnalysis): ImageKind =>
  a.text.trim().length >= DOCUMENT_MIN_CHARS ? "document" : "picture";

/**
 * The searchable body for an analysed image.
 *
 * A document leads with its own text — that is what the person will search
 * for. A picture has no text worth leading with, so the description carries
 * it. Either way the labels are appended, because a search for "whiteboard"
 * should find the whiteboard photo even though nobody wrote that word.
 */
export const analysisToBody = (a: ImageAnalysis): string => {
  const parts: string[] = [];
  if (classifyImage(a) === "document") {
    parts.push(a.text.trim());
    if (a.description) parts.push(a.description);
  } else {
    if (a.description) parts.push(a.description);
    // Short text on a picture is still worth keeping — a sign, a jersey
    // number — just not as the headline.
    if (a.text.trim()) parts.push(a.text.trim());
  }
  if (a.labels.length) parts.push(a.labels.join(", "));
  return parts.join("\n\n").trim();
};

/**
 * A title for the capture, or null to let the normal titler handle it.
 * Kept short: this shows in a list, not on a page.
 */
export const analysisToTitle = (a: ImageAnalysis): string | null => {
  if (classifyImage(a) === "document") {
    const firstLine = a.text.split("\n").map((l) => l.trim()).find(Boolean);
    if (firstLine) return firstLine.slice(0, 80);
  }
  if (a.description) return a.description.replace(/\.$/, "").slice(0, 80);
  return null;
};

/** Narrow whatever the function returned to the shape the app relies on. */
export const normalizeAnalysis = (raw: unknown): ImageAnalysis => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = typeof r.text === "string" ? r.text : "";
  const labels = Array.isArray(r.labels)
    ? [...new Set(r.labels.filter((l): l is string => typeof l === "string" && l.trim().length > 0))]
        .map((l) => l.trim().toLowerCase())
        .slice(0, 8)
    : [];
  return {
    text,
    labels,
    description: typeof r.description === "string" ? r.description : "",
    hasText: text.trim().length > 0,
  };
};

/**
 * Read an image. Never throws: a capture that cannot be read is still a
 * capture, and losing the user's screenshot because the model was down is a
 * worse outcome than losing the OCR.
 */
export const analyzeImage = async (imageUrl: string): Promise<ImageAnalysis> => {
  try {
    const { data, error } = await supabase.functions.invoke("analyze-image", {
      body: { imageUrl },
    });
    if (error) return EMPTY_ANALYSIS;
    return normalizeAnalysis(data);
  } catch {
    return EMPTY_ANALYSIS;
  }
};
