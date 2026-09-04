import { describe, expect, it } from "vitest";
import { parseShare } from "../shareTarget";

describe("parseShare", () => {
  it("takes the url field when the sharing app fills it in (iOS)", () => {
    expect(parseShare({ title: "A reel", url: "https://www.instagram.com/reel/abc123/" })).toEqual({
      url: "https://www.instagram.com/reel/abc123/",
      note: "A reel",
    });
  });

  it("finds the link inside text, which is where Android usually puts it", () => {
    const { url } = parseShare({ text: "https://www.instagram.com/reel/abc123/" });
    expect(url).toBe("https://www.instagram.com/reel/abc123/");
  });

  it("pulls the link out of surrounding prose and keeps the prose as the note", () => {
    const { url, note } = parseShare({
      text: "you have to see this https://youtu.be/dQw4w9WgXcQ so good",
    });
    expect(url).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(note).toBe("you have to see this so good");
  });

  it("does not swallow sentence punctuation into the link", () => {
    expect(parseShare({ text: "read this: https://example.com/post." }).url).toBe(
      "https://example.com/post",
    );
  });

  it("drops an unbalanced closing paren from prose", () => {
    expect(parseShare({ text: "(see https://example.com/x)" }).url).toBe("https://example.com/x");
  });

  it("keeps a balanced paren that is genuinely part of the link", () => {
    expect(parseShare({ text: "https://en.wikipedia.org/wiki/Foo_(bar)" }).url).toBe(
      "https://en.wikipedia.org/wiki/Foo_(bar)",
    );
  });

  it("ignores a bare hostname rather than guessing at a link", () => {
    expect(parseShare({ text: "saw it on instagram.com earlier" })).toEqual({
      url: null,
      note: "saw it on instagram.com earlier",
    });
  });

  it("refuses a non-http scheme", () => {
    expect(parseShare({ text: "javascript:alert(1)" }).url).toBeNull();
  });

  it("prefers the url field over a different link buried in text", () => {
    expect(
      parseShare({
        url: "https://example.com/canonical",
        text: "compare with https://example.com/other",
      }).url,
    ).toBe("https://example.com/canonical");
  });

  it("keeps a plain text share as a note with no link", () => {
    expect(parseShare({ title: "Idea", text: "build the thing at 4am" })).toEqual({
      url: null,
      note: "Idea\n\nbuild the thing at 4am",
    });
  });

  it("returns empty for an empty share rather than throwing", () => {
    expect(parseShare({})).toEqual({ url: null, note: "" });
  });

  it("does not repeat the title when it duplicates the text", () => {
    expect(parseShare({ title: "same", text: "same" }).note).toBe("same");
  });
});
