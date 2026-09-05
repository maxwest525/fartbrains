import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));

import {
  EXPORT_TABLES,
  exportFilename,
  exportToMarkdown,
  ideaToMarkdown,
  stripSecrets,
  type AccountExport,
} from "@/lib/exportAccount";

const exp = (over: Partial<AccountExport["data"]> = {}): AccountExport => ({
  version: 1,
  exportedAt: "2026-09-03T00:00:00.000Z",
  data: { ideas: [], folders: [], ...over },
});

describe("stripSecrets", () => {
  it("removes share token hashes and push keys", () => {
    const row = stripSecrets({
      id: "1",
      title: "keep me",
      token_hash: "abc",
      auth_key: "k",
      p256dh: "p",
      endpoint: "https://push",
    });
    expect(row).toEqual({ id: "1", title: "keep me" });
  });

  it("leaves ordinary content untouched", () => {
    const row = { id: "1", raw_note: "my private note", tags: ["a"] };
    expect(stripSecrets(row)).toEqual(row);
  });
});

describe("ideaToMarkdown", () => {
  it("renders title, summary, note and extracted text", () => {
    const md = ideaToMarkdown({
      title: "Cold DMs",
      ai_summary: "A summary",
      raw_note: "My note",
      extracted_text: "Page text",
      tags: ["sales", "b2b"],
      source_url: "https://example.com",
      created_at: "2026-01-01",
    });
    expect(md).toContain("# Cold DMs");
    expect(md).toContain("## Summary");
    expect(md).toContain("A summary");
    expect(md).toContain("## Note");
    expect(md).toContain("My note");
    expect(md).toContain("## Extracted text");
    expect(md).toContain("sales, b2b");
    expect(md).toContain("https://example.com");
  });

  it("survives a missing title and empty sections", () => {
    const md = ideaToMarkdown({});
    expect(md).toContain("# Untitled");
    expect(md).not.toContain("## Summary");
  });

  it("does not let a newline in the title break the heading", () => {
    const md = ideaToMarkdown({ title: "one\ntwo" });
    expect(md.split("\n")[0]).toBe("# one two");
  });
});

describe("exportToMarkdown", () => {
  it("groups ideas under their folder and files the rest under Unfiled", () => {
    const md = exportToMarkdown(
      exp({
        folders: [{ id: "f1", name: "Research" }],
        ideas: [
          { id: "i1", title: "In folder", folder_id: "f1" },
          { id: "i2", title: "Loose", folder_id: null },
        ],
      }),
    );
    expect(md).toContain("## Research");
    expect(md).toContain("## Unfiled");
    expect(md).toContain("### In folder");
    expect(md).toContain("### Loose");
  });

  it("reports the item count", () => {
    expect(exportToMarkdown(exp({ ideas: [{ id: "i1", title: "x" }] }))).toContain("1 item.");
    expect(exportToMarkdown(exp())).toContain("0 items.");
  });
});

describe("export scope", () => {
  it("covers every user-owned content table", () => {
    for (const t of [
      "ideas", "folders", "idea_chats", "idea_references",
      "idea_reminders", "todos", "calendar_events", "user_instructions", "user_drafts",
    ]) {
      expect(EXPORT_TABLES).toContain(t);
    }
  });

  it("never exports the share table, which holds only token hashes", () => {
    expect(EXPORT_TABLES).not.toContain("idea_shares");
  });

  it("names files by export date", () => {
    expect(exportFilename("json", new Date("2026-09-03T10:00:00Z")))
      .toBe("fartbrains-export-2026-09-03.json");
  });
});
