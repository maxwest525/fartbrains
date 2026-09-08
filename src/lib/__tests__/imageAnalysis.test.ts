import { describe, it, expect } from "vitest";
import {
  analysisToBody,
  analysisToTitle,
  classifyImage,
  normalizeAnalysis,
  type ImageAnalysis,
} from "../imageAnalysis";

const a = (o: Partial<ImageAnalysis>): ImageAnalysis => ({
  text: "",
  labels: [],
  description: "",
  hasText: false,
  ...o,
});

const PRICING = `Starter $19/mo
Pro $49/mo includes deep research and unlimited briefs
Enterprise contact us`;

describe("classifyImage", () => {
  it("treats a screenshot with real text as a document", () => {
    expect(classifyImage(a({ text: PRICING }))).toBe("document");
  });

  it("treats a photo with only a timestamp as a picture", () => {
    expect(classifyImage(a({ text: "9:41" }))).toBe("picture");
  });

  it("treats an image with no text as a picture", () => {
    expect(classifyImage(a({ description: "A dog on a beach" }))).toBe("picture");
  });
});

describe("analysisToBody", () => {
  it("leads a document with its own text", () => {
    const body = analysisToBody(a({ text: PRICING, description: "A pricing table", labels: ["pricing"] }));
    expect(body.startsWith("Starter $19/mo")).toBe(true);
    expect(body).toContain("pricing");
  });

  it("leads a picture with the description and keeps stray text", () => {
    const body = analysisToBody(a({ text: "9:41", description: "A dog on a beach", labels: ["dog", "beach"] }));
    expect(body.startsWith("A dog on a beach")).toBe(true);
    expect(body).toContain("9:41");
    expect(body).toContain("dog, beach");
  });

  it("is empty when there is nothing to say", () => {
    expect(analysisToBody(a({}))).toBe("");
  });
});

describe("analysisToTitle", () => {
  it("uses the first line of a document", () => {
    expect(analysisToTitle(a({ text: PRICING }))).toBe("Starter $19/mo");
  });

  it("skips leading blank lines", () => {
    expect(analysisToTitle(a({ text: "\n\n  Q3 roadmap  \nrest of the deck goes here and then some more" }))).toBe("Q3 roadmap");
  });

  it("falls back to the description for a picture", () => {
    expect(analysisToTitle(a({ description: "A dog on a beach." }))).toBe("A dog on a beach");
  });

  it("returns null rather than inventing a title", () => {
    expect(analysisToTitle(a({}))).toBeNull();
  });

  it("truncates a long first line", () => {
    expect(analysisToTitle(a({ text: "x".repeat(200) }))?.length).toBe(80);
  });
});

describe("normalizeAnalysis", () => {
  it("keeps a well-formed payload", () => {
    const n = normalizeAnalysis({ text: "hi there friend", labels: ["a", "b"], description: "d" });
    expect(n.labels).toEqual(["a", "b"]);
    expect(n.hasText).toBe(true);
  });

  it("survives junk", () => {
    expect(normalizeAnalysis(null)).toEqual({ text: "", labels: [], description: "", hasText: false });
    expect(normalizeAnalysis({ text: 5, labels: "nope" }).labels).toEqual([]);
  });

  it("drops non-strings and duplicates from labels", () => {
    expect(normalizeAnalysis({ labels: ["Dog", "Dog", 7, "", "beach"] }).labels).toEqual(["dog", "beach"]);
  });

  it("does not call whitespace-only text present", () => {
    expect(normalizeAnalysis({ text: "   \n " }).hasText).toBe(false);
  });
});
