import { useState } from "react";
import { Plus, X, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DELIVERABLE_TYPES,
  appendDeliverable,
  deleteDeliverable,
  getTypeMeta,
  parseDeliverables,
  toggleDeliverable,
  updateDeliverable,
  type Deliverable,
  type DeliverableType,
} from "@/lib/deliverables";

type Props = {
  rawNote: string | null;
  /** Persist a new raw_note value. Parent owns mutation state. */
  onChange: (next: string) => void;
};

/**
 * Renders a project idea's deliverables as a typed, grouped checklist board.
 * All edits flow through `onChange(rawNote')` so the parent (IdeaDetail)
 * keeps using its existing `useUpdateIdea` plumbing.
 */
export const ProjectBoard = ({ rawNote, onChange }: Props) => {
  const items = parseDeliverables(rawNote);
  const [activeType, setActiveType] = useState<DeliverableType>("task");
  const [draft, setDraft] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const grouped = (() => {
    const order: DeliverableType[] = [];
    const map = new Map<DeliverableType, Deliverable[]>();
    items.forEach((item) => {
      if (!map.has(item.type)) {
        map.set(item.type, []);
        order.push(item.type);
      }
      map.get(item.type)!.push(item);
    });
    return order.map((type) => ({ type, entries: map.get(type)! }));
  })();

  const addItem = (type: DeliverableType, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onChange(appendDeliverable(rawNote ?? "", type, trimmed));
  };

  const handleAddDraft = () => {
    addItem(activeType, draft);
    setDraft("");
  };

  const handleToggle = (item: Deliverable) => {
    onChange(toggleDeliverable(rawNote ?? "", item.index));
  };

  const handleDelete = (item: Deliverable) => {
    onChange(deleteDeliverable(rawNote ?? "", item.index));
  };

  const beginEdit = (item: Deliverable) => {
    setEditingIndex(item.index);
    setEditText(item.text);
  };

  const commitEdit = (item: Deliverable) => {
    const next = editText.trim();
    if (next && next !== item.text) {
      onChange(updateDeliverable(rawNote ?? "", item.index, { text: next }));
    } else if (!next) {
      onChange(deleteDeliverable(rawNote ?? "", item.index));
    }
    setEditingIndex(null);
    setEditText("");
  };

  const handleChangeType = (item: Deliverable, type: DeliverableType) => {
    if (item.type === type) return;
    onChange(updateDeliverable(rawNote ?? "", item.index, { type }));
  };

  return (
    <section className="space-y-4">
      {/* Header: progress */}
      <div className="rounded-xl bg-muted/40 p-3">
        <div className="flex items-center justify-between text-sm font-medium mb-1.5">
          <span>Deliverables</span>
          <span className="text-muted-foreground">
            {done} / {total} done · {pct}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Quick add */}
      <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 no-scrollbar scroll-momentum">
          {DELIVERABLE_TYPES.map((t) => {
            const Icon = t.icon;
            const active = activeType === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveType(t.key)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium border transition-colors press",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/60 text-muted-foreground border-transparent hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddDraft();
              }
            }}
            placeholder={`Add a ${getTypeMeta(activeType).label.toLowerCase()}…`}
            className="h-11 flex-1 rounded-lg bg-secondary/60 border-transparent text-[15px] px-3"
          />
          <Button
            type="button"
            onClick={handleAddDraft}
            disabled={!draft.trim()}
            className="h-11 rounded-lg px-3"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Groups */}
      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground italic px-1">
          No deliverables yet. Add the first one above.
        </p>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ type, entries }) => {
            const meta = getTypeMeta(type);
            const Icon = meta.icon;
            const groupDone = entries.filter((e) => e.done).length;
            return (
              <div key={type} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border/60">
                  <div className={cn("h-7 w-7 rounded-md flex items-center justify-center", meta.tone)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[13px] font-semibold uppercase tracking-wide">
                    {meta.label}
                  </span>
                  <span className="text-[12px] text-muted-foreground ml-auto">
                    {groupDone} / {entries.length}
                  </span>
                </div>
                <ul className="divide-y divide-border/60">
                  {entries.map((item) => {
                    const isEditing = editingIndex === item.index;
                    return (
                      <li
                        key={item.index}
                        className="flex items-center gap-2 px-3 py-2 group"
                      >
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() => handleToggle(item)}
                          className="h-4 w-4 cursor-pointer accent-primary shrink-0"
                          aria-label={item.done ? "Mark as not done" : "Mark as done"}
                        />
                        {isEditing ? (
                          <Input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitEdit(item);
                              } else if (e.key === "Escape") {
                                setEditingIndex(null);
                                setEditText("");
                              }
                            }}
                            autoFocus
                            className="h-8 flex-1 text-[14px] px-2"
                          />
                        ) : (
                          <span
                            className={cn(
                              "flex-1 text-[14px] leading-snug",
                              item.done && "line-through text-muted-foreground"
                            )}
                          >
                            {item.text}
                          </span>
                        )}

                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => commitEdit(item)}
                            className="press h-7 w-7 inline-flex items-center justify-center text-primary"
                            aria-label="Save"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        ) : (
                          <>
                            {/* Type re-pick (compact) */}
                            <select
                              value={item.type}
                              onChange={(e) => handleChangeType(item, e.target.value as DeliverableType)}
                              className="h-7 text-[12px] rounded-md bg-secondary/60 border border-transparent px-1.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              aria-label="Change type"
                            >
                              {DELIVERABLE_TYPES.map((t) => (
                                <option key={t.key} value={t.key}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => beginEdit(item)}
                              className="press h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                              aria-label="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item)}
                              className="press h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                              aria-label="Delete"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() => addItem(type, prompt(`Add ${meta.label.toLowerCase()} item`) ?? "")}
                  className="press w-full text-left text-[13px] text-muted-foreground hover:text-foreground px-3 py-2 inline-flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add {meta.label.toLowerCase()}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
