import { describe, it, expect } from "vitest";
import { suggestFolderBySubject, type FolderSignal } from "../folderRouting";

const FOLDERS: FolderSignal[] = [
  { id: "biz", name: "Business Ideas", tags: ["pricing", "saas", "growth", "pricing", "saas"] },
  { id: "res", name: "Research Ideas", tags: ["papers", "ml", "benchmarks", "ml"] },
  { id: "seo", name: "SEO", tags: ["seo", "content", "seo", "backlinks"] },
  { id: "misc", name: "Misc", tags: [] },
];

describe("suggestFolderBySubject", () => {
  it("routes on tags shared with what a folder already holds", () => {
    const s = suggestFolderBySubject({ title: "Cheap review pages", tags: ["seo", "backlinks"] }, FOLDERS);
    expect(s?.id).toBe("seo");
    expect(s?.matched).toContain("seo");
  });

  it("routes on the folder's own name when tags do not overlap", () => {
    // "research" matches the name; nothing matches Business Ideas.
    const s = suggestFolderBySubject(
      { title: "A research method for evals", tags: ["research", "evals"] },
      FOLDERS,
    );
    expect(s?.id).toBe("res");
  });

  it("prefers the folder with more corroborating items", () => {
    const s = suggestFolderBySubject({ title: "Per-seat vs usage", tags: ["pricing", "saas"] }, FOLDERS);
    expect(s?.id).toBe("biz");
  });

  it("returns null rather than guessing when nothing matches", () => {
    expect(suggestFolderBySubject({ title: "Dentist at 3pm", tags: ["health"] }, FOLDERS)).toBeNull();
  });

  it("returns null for an item with nothing to go on", () => {
    expect(suggestFolderBySubject({ title: "", tags: [] }, FOLDERS)).toBeNull();
    expect(suggestFolderBySubject({ title: null, tags: null }, FOLDERS)).toBeNull();
  });

  it("ignores generic folder names so everything does not fall into them", () => {
    // "Misc" and the word "ideas" are stopwords — Business Ideas must win on
    // "pricing", not on the shared word "Ideas".
    const s = suggestFolderBySubject({ title: "Some ideas", tags: ["ideas"] }, FOLDERS);
    expect(s).toBeNull();
  });

  it("does not let one enormous folder swallow everything", () => {
    const lopsided: FolderSignal[] = [
      { id: "big", name: "Everything", tags: Array(400).fill("seo") },
      { id: "small", name: "SEO", tags: ["seo", "backlinks"] },
    ];
    // Both match "seo"; the small one also matches on its name, and the big
    // one's advantage is capped, so the specific folder still wins.
    expect(suggestFolderBySubject({ title: "x", tags: ["seo", "backlinks"] }, lopsided)?.id).toBe("small");
  });

  it("is case and whitespace insensitive on tags", () => {
    const s = suggestFolderBySubject({ title: "x", tags: ["  SEO  ", "Backlinks"] }, FOLDERS);
    expect(s?.id).toBe("seo");
  });

  it("handles an empty folder list", () => {
    expect(suggestFolderBySubject({ title: "anything", tags: ["seo"] }, [])).toBeNull();
  });
});
