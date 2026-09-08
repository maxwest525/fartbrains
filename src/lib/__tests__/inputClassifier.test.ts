import { describe, it, expect } from "vitest";
import { classifyInput, isBareUrl } from "../inputClassifier";

describe("isBareUrl", () => {
  it("accepts a URL on its own", () => {
    expect(isBareUrl("https://www.instagram.com/reel/C8xq2f9Lm/")).toBe(true);
    expect(isBareUrl("  http://example.com/a?b=c  ")).toBe(true);
  });

  it("rejects a URL inside a sentence", () => {
    // The whole point: someone citing a link mid-thought is writing a note.
    expect(isBareUrl("look at https://example.com later")).toBe(false);
  });

  it("rejects non-http schemes and non-URLs", () => {
    expect(isBareUrl("javascript:alert(1)")).toBe(false);
    expect(isBareUrl("mailto:a@b.com")).toBe(false);
    expect(isBareUrl("just some words")).toBe(false);
    expect(isBareUrl("")).toBe(false);
  });
});

describe("classifyInput", () => {
  it("routes a pasted link to url", () => {
    expect(classifyInput("https://youtu.be/dQw4w9WgXcQ")).toBe("url");
  });

  it("routes a bulleted list to list", () => {
    expect(classifyInput("- buy milk\n- call dentist\n- ship v2")).toBe("list");
    expect(classifyInput("1. one\n2. two\n3. three")).toBe("list");
  });

  it("does not treat wrapped prose as a list", () => {
    // Three short lines, no bullets — an address, lyrics, a stack trace.
    expect(classifyInput("Jane Doe\n12 High Street\nLondon")).toBe("note");
  });

  it("does not treat two bulleted lines as a list", () => {
    expect(classifyInput("- one\n- two")).toBe("note");
  });

  it("routes long pasted text to transcript", () => {
    expect(classifyInput("word ".repeat(200))).toBe("transcript");
  });

  it("keeps a long bulleted list a list, not a transcript", () => {
    const long = Array.from({ length: 40 }, (_, i) => `- item number ${i}`).join("\n");
    expect(long.length).toBeGreaterThan(600);
    expect(classifyInput(long)).toBe("list");
  });

  it("falls back to note for anything ordinary", () => {
    expect(classifyInput("make this but for instagram too")).toBe("note");
    expect(classifyInput("")).toBe("note");
    expect(classifyInput("   ")).toBe("note");
  });
});
