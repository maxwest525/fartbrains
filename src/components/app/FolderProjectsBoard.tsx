import { useMemo, useState, useEffect, useRef } from "react";
import { Briefcase, ChevronDown, ChevronRight, Pencil, Check, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DELIVERABLE_TYPES,
  PROJECT_TAG,
  deleteDeliverable,
  deliverableStats,
  getTypeMeta,
  parseDeliverables,
  toggleDeliverable,
  updateDeliverable,
  type Deliverable,
  type DeliverableType,
} from "@/lib/deliverables";
import type { Idea } from "@/hooks/useIdeas";
import { useUpdateIdea } from "@/hooks/useIdeas";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  /** All ideas in the current folder, in the order returned by the query. */
  ideas: Idea[];
  /** Open the underlying idea detail when the user taps the project header. */
  onOpenProject: (id: string) => void;
};

/**
 * Inside a folder, surface every project idea as a collapsible board grouped
 * by project (e.g., "TruMove") and then by deliverable type (Task, Buy, …).
 *
 * Reads/writes flow through `useUpdateIdea` so toggling a checkbox here stays
 * consistent with the ProjectBoard inside the idea detail view.
 */
export const FolderProjectsBoard = ({ ideas, onOpenProject }: Props) => {
  const updateIdea = useUpdateIdea();

  // Only project ideas participate in this view.
  const projects = useMemo(
    () => ideas.filter((i) => i.tags.includes(PROJECT_TAG)),
    [ideas],
  );

  // Collapsed/expanded state per project. Default: expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapsed = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Inline edit state, keyed by `${ideaId}:${itemIndex}`.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingKey) editInputRef.current?.focus();
  }, [editingKey]);

  const beginEdit = (ideaId: string, item: Deliverable) => {
    setEditingKey(`${ideaId}:${item.index}`);
    setEditText(item.text);
  };
  const cancelEdit = () => {
    setEditingKey(null);
    setEditText("");
  };
  const commitEdit = (idea: Idea, item: Deliverable) => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === item.text) {
      cancelEdit();
      return;
    }
    const nextRaw = updateDeliverable(idea.raw_note ?? "", item.index, { text: trimmed });
    updateIdea.mutate({ id: idea.id, patch: { raw_note: nextRaw } });
    cancelEdit();
  };

  if (projects.length === 0) return null;

  return (
    <section className="px-4 md:px-5 pt-1 pb-2 space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[12px] uppercase tracking-wide font-semibold text-muted-foreground">
          Projects
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </span>
      </div>

      <div className="space-y-3">
        {projects.map((idea) => {
          const items = parseDeliverables(idea.raw_note);
          const stats = deliverableStats(idea.raw_note);
          const pct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100);
          const isCollapsed = collapsed.has(idea.id);

          // Group items by type, preserving first-seen order.
          const grouped: Array<{ type: DeliverableType; entries: Deliverable[] }> = (() => {
            const order: DeliverableType[] = [];
            const map = new Map<DeliverableType, Deliverable[]>();
            for (const it of items) {
              if (!map.has(it.type)) {
                map.set(it.type, []);
                order.push(it.type);
              }
              map.get(it.type)!.push(it);
            }
            return order.map((type) => ({ type, entries: map.get(type)! }));
          })();

          const handleToggle = (item: Deliverable) => {
            const nextRaw = toggleDeliverable(idea.raw_note ?? "", item.index);
            updateIdea.mutate({ id: idea.id, patch: { raw_note: nextRaw } });
          };

          return (
            <div
              key={idea.id}
              className="rounded-2xl border border-border/60 bg-card overflow-hidden"
            >
              {/* Project header */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 border-b border-border/60">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(idea.id)}
                  aria-label={isCollapsed ? "Expand project" : "Collapse project"}
                  className="press h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                <div className="h-7 w-7 rounded-md flex items-center justify-center bg-primary text-primary-foreground shrink-0">
                  <Briefcase className="h-4 w-4" />
                </div>
                <button
                  type="button"
                  onClick={() => onOpenProject(idea.id)}
                  className="flex-1 min-w-0 text-left press"
                >
                  <p className="font-semibold text-[14px] truncate leading-tight">
                    {idea.title}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground tabular-nums">
                    {stats.done} / {stats.total} done · {pct}%
                  </p>
                </button>
                <div className="hidden sm:block w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Type-grouped deliverables */}
              {!isCollapsed && (
                grouped.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground italic px-4 py-3">
                    No deliverables yet.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {grouped.map(({ type, entries }) => {
                      const meta = getTypeMeta(type);
                      const Icon = meta.icon;
                      const groupDone = entries.filter((e) => e.done).length;
                      return (
                        <div key={type}>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-background">
                            <div
                              className={cn(
                                "h-5 w-5 rounded flex items-center justify-center",
                                meta.tone,
                              )}
                            >
                              <Icon className="h-3 w-3" />
                            </div>
                            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {meta.label}
                            </span>
                            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                              {groupDone} / {entries.length}
                            </span>
                          </div>
                          <ul>
                            {entries.map((item) => {
                              const key = `${idea.id}:${item.index}`;
                              const isEditing = editingKey === key;
                              return (
                                <li
                                  key={item.index}
                                  className="group flex items-center gap-2 px-3 py-1.5"
                                >
                                  <input
                                    type="checkbox"
                                    checked={item.done}
                                    onChange={() => handleToggle(item)}
                                    disabled={isEditing}
                                    className="h-4 w-4 cursor-pointer accent-primary shrink-0"
                                    aria-label={
                                      item.done ? "Mark as not done" : "Mark as done"
                                    }
                                  />
                                  {isEditing ? (
                                    <>
                                      <input
                                        ref={editInputRef}
                                        type="text"
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            commitEdit(idea, item);
                                          } else if (e.key === "Escape") {
                                            e.preventDefault();
                                            cancelEdit();
                                          }
                                        }}
                                        onBlur={() => commitEdit(idea, item)}
                                        className="flex-1 min-w-0 bg-background border border-input rounded px-2 py-1 text-[13.5px] leading-snug focus:outline-none focus:ring-2 focus:ring-ring"
                                        aria-label="Edit deliverable text"
                                      />
                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => commitEdit(idea, item)}
                                        aria-label="Save"
                                        className="press min-h-11 min-w-11 sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-primary hover:text-primary/80"
                                      >
                                        <Check className="h-5 w-5 sm:h-4 sm:w-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={cancelEdit}
                                        aria-label="Cancel"
                                        className="press min-h-11 min-w-11 sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground"
                                      >
                                        <X className="h-5 w-5 sm:h-4 sm:w-4" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => beginEdit(idea.id, item)}
                                        className={cn(
                                          "flex-1 min-w-0 text-left text-[13.5px] leading-snug press",
                                          item.done && "line-through text-muted-foreground",
                                        )}
                                      >
                                        {item.text}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => beginEdit(idea.id, item)}
                                        aria-label="Edit deliverable"
                                        className="press min-h-11 min-w-11 sm:h-9 sm:w-9 sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center text-muted-foreground hover:text-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity"
                                      >
                                        <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                      </button>
                                    </>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Subtle divider before the regular idea rows below */}
      <div className="px-1 pt-1">
        <div className="h-px bg-border/60" />
        <p className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground pt-3">
          All ideas
        </p>
      </div>
    </section>
  );
};

// Re-export for convenience so future callers can match other type ordering.
export { DELIVERABLE_TYPES };
