import { describe, expect, it } from "vitest";
import {
  appendDeliverable,
  deleteDeliverable,
  deliverableStats,
  getTypeMeta,
  parseDeliverables,
  serializeDeliverables,
  toggleDeliverable,
  updateDeliverable,
} from "../deliverables";

const BODY = [
  "Some prose above the list.",
  "- [ ] **[buy]** Order resistance bands",
  "- [x] **[call]** Ring the supplier",
  "- [ ] Plain row with no type",
  "",
  "Trailing prose.",
].join("\n");

describe("parsing", () => {
  it("reads type, text and done state in source order", () => {
    expect(parseDeliverables(BODY)).toEqual([
      { index: 0, type: "buy", text: "Order resistance bands", done: false },
      { index: 1, type: "call", text: "Ring the supplier", done: true },
      { index: 2, type: "task", text: "Plain row with no type", done: false },
    ]);
  });

  it("treats an unknown type as a task rather than dropping the row", () => {
    expect(parseDeliverables("- [ ] **[nonsense]** Do it")[0]).toMatchObject({
      type: "task",
      text: "Do it",
    });
  });

  it("accepts an uppercase X", () => {
    expect(parseDeliverables("- [X] **[task]** Done")[0].done).toBe(true);
  });

  it("ignores prose and returns nothing for empty input", () => {
    expect(parseDeliverables("just a note")).toEqual([]);
    expect(parseDeliverables(null)).toEqual([]);
    expect(parseDeliverables(undefined)).toEqual([]);
  });

  it("counts done against total", () => {
    expect(deliverableStats(BODY)).toEqual({ total: 3, done: 1 });
  });
});

describe("editing keeps the surrounding note intact", () => {
  it("toggles one row and leaves the prose alone", () => {
    const next = toggleDeliverable(BODY, 0);
    expect(parseDeliverables(next)[0].done).toBe(true);
    expect(next).toContain("Some prose above the list.");
    expect(next).toContain("Trailing prose.");
  });

  it("toggles back off", () => {
    expect(parseDeliverables(toggleDeliverable(BODY, 1))[1].done).toBe(false);
  });

  it("keeps a typeless row typeless when toggled", () => {
    expect(toggleDeliverable(BODY, 2)).toContain("- [x] Plain row with no type");
  });

  it("updates text and type", () => {
    const next = updateDeliverable(BODY, 0, { type: "ship", text: "Send the bands" });
    expect(parseDeliverables(next)[0]).toMatchObject({ type: "ship", text: "Send the bands" });
  });

  it("deletes the row when an edit empties it", () => {
    expect(parseDeliverables(updateDeliverable(BODY, 0, { text: "   " }))).toHaveLength(2);
  });

  it("deletes by index without disturbing the others", () => {
    const next = deleteDeliverable(BODY, 1);
    expect(parseDeliverables(next).map((d) => d.text)).toEqual([
      "Order resistance bands",
      "Plain row with no type",
    ]);
  });

  it("appends to an existing body and to an empty one", () => {
    expect(parseDeliverables(appendDeliverable(BODY, "decide", "Pick a courier"))).toHaveLength(4);
    expect(appendDeliverable("", "task", "First")).toBe("- [ ] **[task]** First");
    expect(appendDeliverable(BODY, "task", "   ")).toBe(BODY);
  });
});

/**
 * rewriteLine used to mark a dropped row with the literal string
 * "__DELETE__" and then filter every line equal to it — so a note that
 * happened to contain that as a plain line lost it on any toggle or edit.
 */
describe("a note containing the old sentinel string", () => {
  const withSentinel = ["__DELETE__", "- [ ] **[task]** Keep me", "after"].join("\n");

  it("survives a toggle", () => {
    expect(toggleDeliverable(withSentinel, 0)).toContain("__DELETE__");
  });

  it("survives an update", () => {
    expect(updateDeliverable(withSentinel, 0, { text: "Changed" })).toContain("__DELETE__");
  });

  it("survives deleting the row next to it", () => {
    const next = deleteDeliverable(withSentinel, 0);
    expect(next).toContain("__DELETE__");
    expect(next).toContain("after");
    expect(parseDeliverables(next)).toHaveLength(0);
  });
});

describe("serialize", () => {
  it("round-trips through parse", () => {
    const items = parseDeliverables(BODY).map(({ type, text, done }) => ({ type, text, done }));
    expect(parseDeliverables(serializeDeliverables(items)).map((d) => d.text)).toEqual(
      items.map((i) => i.text),
    );
  });

  it("drops blank rows", () => {
    expect(serializeDeliverables([{ type: "task", text: "  ", done: false }])).toBe("");
  });
});

describe("getTypeMeta", () => {
  it("falls back to the last type for anything unknown", () => {
    expect(getTypeMeta("nope").key).toBe("other");
    expect(getTypeMeta("buy").key).toBe("buy");
  });
});
