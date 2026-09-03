import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Deleting must never issue a DELETE, live lists must exclude trashed rows, and
 * permanent deletion must be scoped to rows already in the trash. These assert
 * the queries actually sent to Supabase.
 */
const h = vi.hoisted(() => {
  const calls: { table: string; op: string; args: unknown[] }[] = [];
  const chain = (table: string) => {
    const rec = (op: string) => (...args: unknown[]) => {
      calls.push({ table, op, args });
      return proxy;
    };
    const proxy = {
      select: rec("select"),
      update: rec("update"),
      delete: rec("delete"),
      eq: rec("eq"),
      is: rec("is"),
      not: rec("not"),
      or: rec("or"),
      order: rec("order"),
      limit: rec("limit"),
      range: rec("range"),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null }),
    };
    return proxy;
  };
  return { calls, supabase: { from: (t: string) => chain(t) } };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: h.supabase }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useIdeaReferences", () => ({ triggerExtractReferences: vi.fn() }));
vi.mock("@/lib/amosFolderSync", () => ({ maybeSyncIdeaToAmosByFolder: vi.fn() }));

import {
  IDEAS_PAGE_SIZE,
  useDeleteIdea,
  useEmptyTrash,
  useIdeas,
  usePurgeIdea,
  useRestoreIdea,
} from "@/hooks/useIdeas";

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

const ops = (op: string) => h.calls.filter((c) => c.op === op);

beforeEach(() => { h.calls.length = 0; });

describe("deleting an idea", () => {
  it("soft-deletes instead of destroying the row", async () => {
    const { result } = renderHook(() => useDeleteIdea(), { wrapper });
    result.current.mutate("idea-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(ops("delete")).toHaveLength(0);
    const update = ops("update")[0];
    expect(update.table).toBe("ideas");
    expect(update.args[0]).toHaveProperty("deleted_at");
    expect((update.args[0] as { deleted_at: string }).deleted_at).toBeTruthy();
  });
});

describe("restoring an idea", () => {
  it("clears deleted_at", async () => {
    const { result } = renderHook(() => useRestoreIdea(), { wrapper });
    result.current.mutate("idea-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(ops("delete")).toHaveLength(0);
    expect(ops("update")[0].args[0]).toEqual({ deleted_at: null });
  });
});

describe("permanent deletion", () => {
  it("only ever targets rows already in the trash", async () => {
    const { result } = renderHook(() => usePurgeIdea(), { wrapper });
    result.current.mutate("idea-1");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(ops("delete")).toHaveLength(1);
    expect(ops("not").some((c) => c.args[0] === "deleted_at")).toBe(true);
  });

  it("emptying the trash is scoped to trashed rows", async () => {
    const { result } = renderHook(() => useEmptyTrash(), { wrapper });
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(ops("delete")).toHaveLength(1);
    expect(ops("not").some((c) => c.args[0] === "deleted_at")).toBe(true);
  });
});

describe("listing ideas", () => {
  it("excludes trashed items from the normal library", async () => {
    const { result } = renderHook(() => useIdeas({ kind: "all" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(ops("is").some((c) => c.args[0] === "deleted_at" && c.args[1] === null)).toBe(true);
    expect(ops("not")).toHaveLength(0);
  });

  it("never fetches the whole vault", async () => {
    const { result } = renderHook(() => useIdeas({ kind: "all" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const range = ops("range")[0];
    expect(range).toBeDefined();
    expect(range.args).toEqual([0, IDEAS_PAGE_SIZE - 1]);
  });

  it("honours a caller-supplied page size", async () => {
    const { result } = renderHook(() => useIdeas({ kind: "all" }, 10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(ops("range")[0].args).toEqual([0, 9]);
  });

  it("the trash view shows only trashed items", async () => {
    const { result } = renderHook(() => useIdeas({ kind: "trash" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(ops("not").some((c) => c.args[0] === "deleted_at")).toBe(true);
    expect(ops("is")).toHaveLength(0);
  });
});
