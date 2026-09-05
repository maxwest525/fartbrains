import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Supabase client is replaced with a recording stub. Each call records the
 * table, the order column and the requested range, and replays a page from a
 * fixture, so the test can assert what the exporter actually asked the server
 * for — which is where the paging bug lived.
 */
const calls: { table: string; order: string; from: number; to: number }[] = [];
let pages: Record<string, unknown[]> = {};
let failWith: string | null = null;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const q: {
        select: () => typeof q;
        order: (col: string) => typeof q;
        range: (from: number, to: number) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        _order: string;
      } = {
        select: () => q,
        order(col: string) {
          q._order = col;
          return q;
        },
        range(from: number, to: number) {
          calls.push({ table, order: q._order, from, to });
          if (failWith) return Promise.resolve({ data: null, error: { message: failWith } });
          const all = pages[table] ?? [];
          return Promise.resolve({ data: all.slice(from, to + 1), error: null });
        },
        _order: "",
      };
      return q;
    },
  },
}));

const {
  buildAccountExport,
  fetchAllRows,
  EXPORT_PAGE_SIZE,
  EXPORT_TABLES,
  ORDER_KEY,
} = await import("../exportAccount");

const rows = (n: number, prefix = "r") =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, title: `t${i}` }));

beforeEach(() => {
  calls.length = 0;
  pages = {};
  failWith = null;
});

describe("fetchAllRows", () => {
  it("returns every row past the first page", async () => {
    pages.ideas = rows(EXPORT_PAGE_SIZE + 7);
    const out = await fetchAllRows("ideas");
    expect(out).toHaveLength(EXPORT_PAGE_SIZE + 7);
    expect((out.at(-1) as { id: string }).id).toBe(`r${EXPORT_PAGE_SIZE + 6}`);
  });

  it("requests contiguous, non-overlapping ranges", async () => {
    pages.ideas = rows(EXPORT_PAGE_SIZE * 2 + 1);
    await fetchAllRows("ideas");
    expect(calls.map((c) => [c.from, c.to])).toEqual([
      [0, EXPORT_PAGE_SIZE - 1],
      [EXPORT_PAGE_SIZE, EXPORT_PAGE_SIZE * 2 - 1],
      [EXPORT_PAGE_SIZE * 2, EXPORT_PAGE_SIZE * 3 - 1],
    ]);
  });

  it("stops after one request when the table is short", async () => {
    pages.ideas = rows(3);
    await fetchAllRows("ideas");
    expect(calls).toHaveLength(1);
  });

  it("stops on an exactly-full final page without looping forever", async () => {
    pages.ideas = rows(EXPORT_PAGE_SIZE);
    const out = await fetchAllRows("ideas");
    expect(out).toHaveLength(EXPORT_PAGE_SIZE);
    expect(calls).toHaveLength(2); // second page comes back empty
  });

  it("orders every page so rows cannot be skipped or duplicated", async () => {
    pages.ideas = rows(EXPORT_PAGE_SIZE + 1);
    await fetchAllRows("ideas");
    expect(calls.every((c) => c.order === "id")).toBe(true);
  });

  it("orders user_instructions by user_id, which is its only key", () => {
    expect(ORDER_KEY.user_instructions).toBe("user_id");
  });

  it("names an order column for every exported table", () => {
    for (const t of EXPORT_TABLES) expect(ORDER_KEY[t]).toBeTruthy();
  });

  it("throws rather than handing back a partial export", async () => {
    failWith = "permission denied";
    await expect(fetchAllRows("ideas")).rejects.toThrow(/Couldn't export ideas/);
  });
});

describe("buildAccountExport", () => {
  it("covers every table and strips secrets", async () => {
    pages.ideas = [{ id: "a", title: "x", token_hash: "deadbeef", p256dh: "k" }];
    const exp = await buildAccountExport();
    expect(Object.keys(exp.data).sort()).toEqual([...EXPORT_TABLES].sort());
    expect(exp.data.ideas[0]).toEqual({ id: "a", title: "x" });
    expect(exp.version).toBe(1);
  });
});
