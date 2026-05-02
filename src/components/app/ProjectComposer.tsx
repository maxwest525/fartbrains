import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DELIVERABLE_TYPES,
  getTypeMeta,
  serializeDeliverables,
  type DeliverableType,
} from "@/lib/deliverables";
import { VoiceCaptureButton } from "./VoiceCaptureButton";

type DraftItem = { type: DeliverableType; text: string; done: boolean };

type Props = {
  saving: boolean;
  /** Called when the user hits "Create project". Parent persists the idea. */
  onCreate: (params: { name: string; rawNote: string }) => void | Promise<void>;
};

/**
 * Capture form for a "Project" idea. The user names the project and adds
 * typed deliverables (task, buy, build, meeting, …). Items are kept in local
 * state and only flushed to the database when the user hits Create — so they
 * can build the whole list in one go without waiting on round-trips.
 */
export const ProjectComposer = ({ saving, onCreate }: Props) => {
  const [name, setName] = useState("");
  const [activeType, setActiveType] = useState<DeliverableType>("task");
  const [draft, setDraft] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    setItems((prev) => [...prev, { type: activeType, text, done: false }]);
    setDraft("");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName || items.length === 0) return;
    onCreate({ name: trimmedName, rawNote: serializeDeliverables(items) });
  };

  // Group for the live preview, preserving the order types first appear in.
  const grouped = (() => {
    const order: DeliverableType[] = [];
    const map = new Map<DeliverableType, Array<{ item: DraftItem; index: number }>>();
    items.forEach((item, index) => {
      if (!map.has(item.type)) {
        map.set(item.type, []);
        order.push(item.type);
      }
      map.get(item.type)!.push({ item, index });
    });
    return order.map((type) => ({ type, entries: map.get(type)! }));
  })();

  const canCreate = name.trim().length > 0 && items.length > 0 && !saving;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
          Project name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. TruMove launch"
          autoFocus
          className="h-14 rounded-2xl bg-secondary/60 border-transparent text-[18px] font-semibold px-4 placeholder:font-normal placeholder:text-muted-foreground/70"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
          Add a deliverable
        </label>

        {/* Type chips */}
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

        {/* Quick add input */}
        <div className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder={`What needs to be ${getTypeMeta(activeType).label.toLowerCase()}-ed?`}
            className="h-12 flex-1 rounded-xl bg-secondary/60 border-transparent text-[15px] px-4 placeholder:text-muted-foreground/70"
          />
          <Button
            type="button"
            onClick={addItem}
            disabled={!draft.trim()}
            className="h-12 rounded-xl px-4"
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Live preview, grouped by type */}
      {grouped.length > 0 && (
        <div className="rounded-2xl bg-secondary/40 p-2 space-y-2">
          {grouped.map(({ type, entries }) => {
            const meta = getTypeMeta(type);
            const Icon = meta.icon;
            return (
              <div key={type} className="space-y-1">
                <div className="flex items-center gap-2 px-1.5">
                  <div className={cn("h-6 w-6 rounded-md flex items-center justify-center", meta.tone)}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {meta.label}
                  </span>
                  <span className="text-[12px] text-muted-foreground">· {entries.length}</span>
                </div>
                <ul className="space-y-1">
                  {entries.map(({ item, index }) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 rounded-lg bg-card/80 px-2.5 py-1.5 text-[14px]"
                    >
                      <span className="flex-1 truncate">{item.text}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="press h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-destructive"
                        aria-label="Remove item"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <Button
        onClick={handleCreate}
        disabled={!canCreate}
        className="w-full h-12 rounded-xl text-[16px] font-semibold"
      >
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            Create project
            {items.length > 0 && (
              <span className="ml-1.5 text-primary-foreground/80">· {items.length}</span>
            )}
          </>
        )}
      </Button>
    </div>
  );
};
