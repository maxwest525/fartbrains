import { describe, it, expect } from "vitest";
import {
  candidateFilter,
  filterSafeTerms,
  scoreRows,
  type VaultRow,
} from "../../../supabase/functions/_shared/vault-context";

const DAY = 86_400_000;
const NOW = new Date("2026-09-08T12:00:00Z").getTime();

const row = (o: Partial<VaultRow> & { id: string }): VaultRow => ({
  created_at: new Date(NOW - 200 * DAY).toISOString(),
  ...o,
});

describe("scoreRows", () => {
  it("ranks a title match above a body match", () => {
    const hits = scoreRows(
      [
        row({ id: "body", raw_note: "some notes about pricing strategy" }),
        row({ id: "title", title: "Pricing teardown" }),
      ],
      ["pricing"],
      undefined,
      NOW,
    );
    expect(hits.map((h) => h.id)).toEqual(["title", "body"]);
  });

  it("ranks a tag match above a body match and below a title match", () => {
    const hits = scoreRows(
      [
        row({ id: "body", ai_summary: "mentions pricing once" }),
        row({ id: "tag", tags: ["pricing"] }),
        row({ id: "title", title: "Pricing" }),
      ],
      ["pricing"],
      undefined,
      NOW,
    );
    expect(hits.map((h) => h.id)).toEqual(["title", "tag", "body"]);
  });

  it("drops rows that match nothing rather than returning them with score 0", () => {
    const hits = scoreRows([row({ id: "a", title: "Dentist" })], ["pricing"], undefined, NOW);
    expect(hits).toEqual([]);
  });

  it("excludes the idea being viewed", () => {
    const rows = [row({ id: "self", title: "Pricing" }), row({ id: "other", title: "Pricing" })];
    expect(scoreRows(rows, ["pricing"], "self", NOW).map((h) => h.id)).toEqual(["other"]);
  });

  it("does not let recency outrank a genuinely better match", () => {
    // This is the whole reason the boost is capped at +2: a weak match from
    // today must not bury a strong one from last year.
    const hits = scoreRows(
      [
        row({ id: "new-weak", raw_note: "pricing", created_at: new Date(NOW).toISOString() }),
        row({ id: "old-strong", title: "Pricing", tags: ["pricing"] }),
      ],
      ["pricing"],
      undefined,
      NOW,
    );
    expect(hits[0].id).toBe("old-strong");
  });

  it("uses recency to break a tie between equal matches", () => {
    const hits = scoreRows(
      [
        row({ id: "old", title: "Pricing" }),
        row({ id: "new", title: "Pricing", created_at: new Date(NOW).toISOString() }),
      ],
      ["pricing"],
      undefined,
      NOW,
    );
    expect(hits[0].id).toBe("new");
  });

  it("explains why each hit was returned", () => {
    const [hit] = scoreRows(
      [row({ id: "a", title: "Pricing teardown", tags: ["pricing"], ai_summary: "about pricing" })],
      ["pricing"],
      undefined,
      NOW,
    );
    expect(hit.reason).toContain("title matches");
    expect(hit.reason).toContain("tagged with");
    expect(hit.matchedTerms).toEqual(["pricing"]);
  });

  it("scores every term, so a two-term match beats a one-term match", () => {
    const hits = scoreRows(
      [
        row({ id: "one", title: "Pricing" }),
        row({ id: "two", title: "Pricing and churn" }),
      ],
      ["pricing", "churn"],
      undefined,
      NOW,
    );
    expect(hits[0].id).toBe("two");
  });

  it("survives missing and malformed fields", () => {
    const hits = scoreRows(
      [row({ id: "a", title: null, tags: "not an array", raw_note: null, ai_summary: "pricing" })],
      ["pricing"],
      undefined,
      NOW,
    );
    expect(hits[0].tags).toEqual([]);
    expect(hits[0].title).toBe("(untitled)");
  });

  it("handles an empty row set and empty terms", () => {
    expect(scoreRows([], ["pricing"], undefined, NOW)).toEqual([]);
    expect(scoreRows([row({ id: "a", title: "Pricing" })], [], undefined, NOW)).toEqual([]);
  });
});

describe("candidateFilter", () => {
  it("matches each term against every searchable field", () => {
    expect(candidateFilter(["pricing"])).toBe(
      "title.ilike.%pricing%,ai_summary.ilike.%pricing%,raw_note.ilike.%pricing%,extracted_text.ilike.%pricing%",
    );
  });

  it("includes extracted_text", () => {
    // Measured against production: 9 of 85 matches for a sample term appear
    // only in extracted_text. Excluding it drops 11% of results silently,
    // which is the same bug as the row window this replaced.
    expect(candidateFilter(["pricing"])).toContain("extracted_text.ilike");
  });

  it("caps the number of terms so the query stays bounded", () => {
    const many = ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"];
    const clauses = candidateFilter(many).split(",");
    expect(clauses).toHaveLength(6 * 4);
  });

  it("is empty for no terms, so the caller can skip the query", () => {
    expect(candidateFilter([])).toBe("");
  });
});

describe("filterSafeTerms", () => {
  it("keeps ordinary words and hyphenated ones", () => {
    expect(filterSafeTerms(["pricing", "cold-email", "gpt4"])).toEqual([
      "pricing",
      "cold-email",
      "gpt4",
    ]);
  });

  it("drops anything that would change the filter's meaning", () => {
    // PostgREST takes no backslash escapes: a comma splits the or() clause
    // list and %/_ are wildcards, so these can only be dropped, not escaped.
    expect(filterSafeTerms(["a,b", "a%b", "a_b", "a(b", "a\\b", "Upper"])).toEqual([]);
  });

  it("caps the list", () => {
    expect(filterSafeTerms(["a1", "b2", "c3", "d4", "e5", "f6", "g7"])).toHaveLength(6);
  });
});
