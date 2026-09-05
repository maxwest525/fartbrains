import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Trash means gone to the person who put it there: the app hides it, search
 * skips it, and a share link stops resolving. An agent is the one caller that
 * can still reach past that, because it holds ids from earlier turns and calls
 * tools by id rather than by browsing.
 *
 * These drive the real tool handlers against a recording Supabase stub, so the
 * assertions are about the queries each tool actually issues.
 */

type Row = Record<string, unknown> | null;

let ideaRow: Row = { id: "idea-1", deleted_at: null };
let filters: { table: string; op: string; args: unknown[] }[] = [];
let inserted: unknown[] = [];

const makeQuery = (table: string, result: () => { data: unknown; error: unknown }) => {
  const q = {
    select: () => q,
    eq: (...args: unknown[]) => (filters.push({ table, op: "eq", args }), q),
    is: (...args: unknown[]) => (filters.push({ table, op: "is", args }), q),
    order: () => q,
    limit: () => Promise.resolve(result()),
    maybeSingle: () => Promise.resolve(result()),
    update: (...args: unknown[]) => (filters.push({ table, op: "update", args }), q),
    insert: (row: unknown) => (inserted.push(row), q),
  };
  return q;
};

const supabase = {
  from(table: string) {
    if (table === "ideas") {
      return makeQuery(table, () => {
        // An update filtered on deleted_at matches nothing when trashed.
        const isUpdate = filters.some((f) => f.table === "ideas" && f.op === "update");
        const trashed = ideaRow && (ideaRow as { deleted_at?: unknown }).deleted_at;
        if (isUpdate) return { data: trashed ? null : ideaRow, error: null };
        return { data: ideaRow, error: null };
      });
    }
    return makeQuery(table, () => ({ data: [], error: null }));
  },
};

vi.mock("../mcp/supabase", async () => {
  const actual = await vi.importActual<typeof import("../mcp/supabase")>("../mcp/supabase");
  return {
    ...actual,
    requireAuth: () => "user-1",
    supabaseForUser: () => supabase,
  };
});

const getIdeaChat = (await import("../mcp/tools/get-idea-chat")).default;
const appendIdeaChat = (await import("../mcp/tools/append-idea-chat")).default;
const updateIdea = (await import("../mcp/tools/update-idea")).default;

const ctx = {} as never;
const text = (r: { content: { text: string }[] }) => r.content[0].text;

beforeEach(() => {
  filters = [];
  inserted = [];
  ideaRow = { id: "idea-1", deleted_at: null };
});

const trash = () => {
  ideaRow = { id: "idea-1", deleted_at: "2026-09-05T00:00:00.000Z" };
};

describe("get_idea_chat", () => {
  it("returns the thread for a live idea", async () => {
    const res = await getIdeaChat.handler({ idea_id: "idea-1" }, ctx);
    expect(res.isError).toBeFalsy();
  });

  it("refuses a trashed idea instead of replaying a deleted conversation", async () => {
    trash();
    const res = await getIdeaChat.handler({ idea_id: "idea-1" }, ctx);
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/Trash/);
  });

  it("says only 'not found' for an idea that is not the caller's", async () => {
    // RLS returns no row either way, so the message must not distinguish them.
    ideaRow = null;
    const res = await getIdeaChat.handler({ idea_id: "idea-1" }, ctx);
    expect(text(res)).toBe("Idea not found");
  });
});

describe("append_idea_chat", () => {
  it("writes to a live idea", async () => {
    const res = await appendIdeaChat.handler(
      { idea_id: "idea-1", role: "assistant", content: "hello" },
      ctx,
    );
    expect(res.isError).toBeFalsy();
    expect(inserted).toHaveLength(1);
  });

  it("writes nothing into a trashed idea's thread", async () => {
    trash();
    const res = await appendIdeaChat.handler(
      { idea_id: "idea-1", role: "assistant", content: "hello" },
      ctx,
    );
    expect(res.isError).toBe(true);
    // The real cost of the old behaviour: the agent reported progress the user
    // could never see, because nothing renders a trashed idea's thread.
    expect(inserted).toEqual([]);
  });
});

describe("update_idea", () => {
  it("edits a live idea", async () => {
    const res = await updateIdea.handler({ idea_id: "idea-1", title: "New" }, ctx);
    expect(res.isError).toBeFalsy();
  });

  it("filters the update on deleted_at so a trashed idea matches nothing", async () => {
    await updateIdea.handler({ idea_id: "idea-1", title: "New" }, ctx);
    expect(filters).toContainEqual({ table: "ideas", op: "is", args: ["deleted_at", null] });
  });

  it("reports not found rather than succeeding into a trashed note", async () => {
    trash();
    const res = await updateIdea.handler({ idea_id: "idea-1", title: "New" }, ctx);
    expect(res.isError).toBe(true);
    expect(text(res)).toMatch(/Trash/);
  });

  it("still refuses an empty patch", async () => {
    const res = await updateIdea.handler({ idea_id: "idea-1" }, ctx);
    expect(text(res)).toBe("Nothing to update");
  });
});
