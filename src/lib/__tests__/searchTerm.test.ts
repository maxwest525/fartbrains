import { describe, expect, it } from "vitest";
import { escapeLike, likeFilterValue } from "../searchTerm";

describe("escapeLike", () => {
  it("escapes the ILIKE wildcards so a term matches literally", () => {
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes backslashes before they can escape something else", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLike("instagram seo")).toBe("instagram seo");
  });
});

describe("likeFilterValue", () => {
  it("quotes the value so a comma cannot be read as filter syntax", () => {
    expect(likeFilterValue("a,b")).toBe('"%a,b%"');
  });

  it("survives a closing bracket, which would otherwise end the or() group", () => {
    expect(likeFilterValue("foo)")).toBe('"%foo)%"');
  });

  it("escapes quotes inside the value", () => {
    expect(likeFilterValue('say "hi"')).toBe('"%say \\"hi\\"%"');
  });

  // Two layers stack: ILIKE turns % into \%, then PostgREST quoting turns
  // that backslash into \\. Unquoting yields \% again, which ILIKE reads as
  // a literal percent — so the doubling is correct, not an over-escape.
  it("still escapes wildcards inside the quoted value", () => {
    expect(likeFilterValue("50%")).toBe('"%50\\\\%%"');
  });

  it("returns null for a blank term rather than matching everything", () => {
    expect(likeFilterValue("")).toBeNull();
    expect(likeFilterValue("   ")).toBeNull();
  });
});
