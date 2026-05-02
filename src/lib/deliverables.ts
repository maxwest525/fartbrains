import {
  CheckSquare,
  ShoppingCart,
  Hammer,
  Package,
  Calendar,
  Phone,
  Search,
  Send,
  GitBranch,
  Circle,
  type LucideIcon,
} from "lucide-react";

/**
 * Deliverable types for "Project" ideas. A project idea is one row in `ideas`
 * tagged with `project`, whose `raw_note` holds a GFM checklist where each
 * line is prefixed with **[<type>]** so we can group/render by type while
 * staying compatible with the existing checklist toggler.
 */
export type DeliverableType =
  | "task"
  | "buy"
  | "build"
  | "order"
  | "meeting"
  | "call"
  | "research"
  | "ship"
  | "decide"
  | "other";

export type DeliverableTypeMeta = {
  key: DeliverableType;
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the colored squircle in lists. */
  tone: string;
};

export const DELIVERABLE_TYPES: DeliverableTypeMeta[] = [
  { key: "task",     label: "Task",     icon: CheckSquare,  tone: "bg-[hsl(240_6%_60%)] text-white" },
  { key: "buy",      label: "Buy",      icon: ShoppingCart, tone: "bg-[hsl(28_100%_55%)] text-white" },
  { key: "build",    label: "Build",    icon: Hammer,       tone: "bg-[hsl(211_100%_50%)] text-white" },
  { key: "order",    label: "Order",    icon: Package,      tone: "bg-[hsl(38_92%_50%)] text-white" },
  { key: "meeting",  label: "Meeting",  icon: Calendar,     tone: "bg-[hsl(280_70%_55%)] text-white" },
  { key: "call",     label: "Call",     icon: Phone,        tone: "bg-[hsl(140_70%_45%)] text-white" },
  { key: "research", label: "Research", icon: Search,       tone: "bg-[hsl(195_85%_45%)] text-white" },
  { key: "ship",     label: "Ship",     icon: Send,         tone: "bg-[hsl(160_70%_40%)] text-white" },
  { key: "decide",   label: "Decide",   icon: GitBranch,    tone: "bg-[hsl(340_75%_55%)] text-white" },
  { key: "other",    label: "Other",    icon: Circle,       tone: "bg-[hsl(240_4%_46%)] text-white" },
];

const TYPE_KEYS = new Set(DELIVERABLE_TYPES.map((t) => t.key));

export const getTypeMeta = (key: string): DeliverableTypeMeta =>
  DELIVERABLE_TYPES.find((t) => t.key === key) ?? DELIVERABLE_TYPES[DELIVERABLE_TYPES.length - 1];

export type Deliverable = {
  /** Stable index into the line stream so toggling/editing knows what to rewrite. */
  index: number;
  type: DeliverableType;
  text: string;
  done: boolean;
};

// Matches: "- [ ] **[buy]** Order resistance bands"
//                    └ type ┘  └─── text ───┘
const LINE_RE = /^(\s*- \[)([ xX])(\]\s+)(?:\*\*\[([a-z]+)\]\*\*\s*)?(.*)$/;

/** Parse the project markdown body into typed deliverables, in source order. */
export const parseDeliverables = (raw: string | null | undefined): Deliverable[] => {
  if (!raw) return [];
  const out: Deliverable[] = [];
  const lines = raw.split("\n");
  let idx = -1;
  for (const line of lines) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    idx += 1;
    const type = (m[4] && TYPE_KEYS.has(m[4]) ? m[4] : "task") as DeliverableType;
    out.push({
      index: idx,
      type,
      text: (m[5] ?? "").trim(),
      done: m[2].toLowerCase() === "x",
    });
  }
  return out;
};

/** Serialize a list of deliverables back into the storage format. */
export const serializeDeliverables = (items: Array<Omit<Deliverable, "index">>): string =>
  items
    .filter((d) => d.text.trim().length > 0)
    .map((d) => `- [${d.done ? "x" : " "}] **[${d.type}]** ${d.text.trim()}`)
    .join("\n");

/** Rewrite the Nth deliverable line (counted by checklist position) in `raw`. */
const rewriteLine = (
  raw: string,
  index: number,
  rewriter: (m: RegExpMatchArray) => string | null,
): string => {
  let n = -1;
  return raw
    .split("\n")
    .map((line) => {
      const m = line.match(LINE_RE);
      if (!m) return line;
      n += 1;
      if (n !== index) return line;
      const next = rewriter(m);
      return next === null ? "__DELETE__" : next;
    })
    .filter((l) => l !== "__DELETE__")
    .join("\n");
};

export const toggleDeliverable = (raw: string, index: number): string =>
  rewriteLine(raw, index, (m) => {
    const flipped = m[2].toLowerCase() === "x" ? " " : "x";
    return `${m[1]}${flipped}${m[3]}${m[4] ? `**[${m[4]}]** ` : ""}${m[5]}`;
  });

export const updateDeliverable = (
  raw: string,
  index: number,
  patch: { type?: DeliverableType; text?: string },
): string =>
  rewriteLine(raw, index, (m) => {
    const currentType = (m[4] && TYPE_KEYS.has(m[4]) ? m[4] : "task") as DeliverableType;
    const type = patch.type ?? currentType;
    const text = (patch.text ?? m[5] ?? "").trim();
    if (!text) return null; // empty edits delete the row
    return `${m[1]}${m[2]}${m[3]}**[${type}]** ${text}`;
  });

export const deleteDeliverable = (raw: string, index: number): string =>
  rewriteLine(raw, index, () => null);

export const appendDeliverable = (
  raw: string,
  type: DeliverableType,
  text: string,
): string => {
  const trimmed = text.trim();
  if (!trimmed) return raw;
  const line = `- [ ] **[${type}]** ${trimmed}`;
  if (!raw || !raw.trim()) return line;
  return `${raw.replace(/\s+$/, "")}\n${line}`;
};

/** Quick stats for the list badge / detail header. */
export const deliverableStats = (raw: string | null | undefined) => {
  const items = parseDeliverables(raw);
  const done = items.filter((i) => i.done).length;
  return { total: items.length, done };
};

export const PROJECT_TAG = "project";
