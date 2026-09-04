import { describe, expect, it } from "vitest";
import { titleTerms } from "../mcp/tools/build-prompt";

describe("titleTerms", () => {
  it("keeps the words that identify the subject", () => {
    expect(titleTerms("Baking Sourdough at High Altitude")).toEqual([
      "baking",
      "sourdough",
      "high",
      "altitude",
    ]);
  });

  it("drops connectives that would match most of the vault", () => {
    expect(titleTerms("How to Repot a Fiddle Leaf Fig in Spring")).not.toContain("how");
  });

  it("strips punctuation rather than searching on it", () => {
    expect(titleTerms("Kayaks, Canoes & Paddleboards")).toEqual([
      "kayaks",
      "canoes",
      "paddleboards",
    ]);
  });

  it("de-duplicates so one repeated word cannot crowd out the query", () => {
    expect(titleTerms("Bread for bread people baking bread")).toEqual([
      "bread",
      "people",
      "baking",
    ]);
  });

  it("caps the term count so a long title stays a usable query", () => {
    expect(titleTerms("alpha bravo charlie delta echo foxtrot golf hotel")).toHaveLength(6);
  });

  it("returns nothing searchable when a title is all stopwords", () => {
    expect(titleTerms("How to be at it")).toEqual([]);
  });
});
