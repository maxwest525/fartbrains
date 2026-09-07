import { useState } from "react";
import { CheckSquare, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo } from "@/hooks/useTodos";
import { useCreateIdea, useDeleteIdea, useIdeas } from "@/hooks/useIdeas";
import { useSyncedDraft } from "@/hooks/useSyncedDraft";

/**
 * The to-do list and the jot pad, without any surrounding chrome.
 *
 * Both bodies are self-contained: they own their queries and mutations, so the
 * desktop split column and the mobile sheet can each render them without
 * threading state through. React Query dedupes the shared cache keys, so
 * mounting a body next to a header that also reads `useTodos` costs one fetch.
 *
 * `size` only scales touch targets and type — on a phone the controls need to
 * be finger-sized, on the desktop column they need to be compact.
 */
export type PanelSize = "compact" | "touch";

const DRAFT_KEY = "desktop-scratchpad-draft-v1";

export const TodoBody = ({ size = "compact" }: { size?: PanelSize }) => {
  const [draft, setDraft] = useState("");
  const { data: todos = [], isLoading } = useTodos();
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();

  const touch = size === "touch";

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    createTodo.mutate(value, { onSuccess: () => setDraft("") });
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className={cn("flex items-center gap-1.5", touch ? "px-3 py-2.5 gap-2" : "p-2")}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Something to do…"
          className={cn(
            "flex-1 rounded-lg bg-white/[0.06] border border-white/12 text-foreground placeholder:text-foreground/45 outline-none focus:border-primary/60",
            touch ? "h-11 px-3 text-[15px]" : "h-8 px-2.5 text-[12.5px]",
          )}
        />
        <button
          onClick={add}
          disabled={!draft.trim() || createTodo.isPending}
          className={cn(
            "inline-flex items-center justify-center rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition disabled:opacity-40",
            touch ? "h-11 w-11" : "h-8 w-8",
          )}
          aria-label="Add to-do"
        >
          {createTodo.isPending ? (
            <Loader2 className={touch ? "h-5 w-5 animate-spin" : "h-4 w-4 animate-spin"} />
          ) : (
            <Plus className={touch ? "h-5 w-5" : "h-4 w-4"} />
          )}
        </button>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto space-y-1", touch ? "px-3 pb-3" : "px-2 pb-2")}>
        {isLoading && <p className="text-[12px] text-foreground/60 px-1 py-1.5">Loading…</p>}
        {!isLoading && todos.length === 0 && (
          <p className="text-[12px] text-foreground/60 px-1 py-1.5">Nothing yet.</p>
        )}
        {todos.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group flex items-start gap-2 rounded-lg bg-white/[0.05] border border-white/10",
              touch ? "px-3 py-2.5" : "px-2 py-1.5",
            )}
          >
            <button
              onClick={() => toggleTodo.mutate({ id: t.id, done: !t.done })}
              className={cn(
                "mt-0.5 shrink-0 rounded-[5px] border transition inline-flex items-center justify-center",
                touch ? "h-5 w-5" : "h-4 w-4",
                t.done ? "border-primary bg-primary/20 text-primary" : "border-white/30",
              )}
              aria-label={t.done ? "Mark as not done" : "Mark as done"}
            >
              {t.done && <CheckSquare className={touch ? "h-3.5 w-3.5" : "h-3 w-3"} />}
            </button>
            <span
              className={cn(
                "flex-1 leading-snug break-words",
                touch ? "text-[15px]" : "text-[12.5px]",
                t.done ? "text-foreground/45 line-through" : "text-foreground/90",
              )}
            >
              {t.title}
            </span>
            <button
              onClick={() => deleteTodo.mutate(t.id)}
              className={cn(
                "transition text-foreground/50 hover:text-destructive",
                // On a phone there is no hover, so the control has to stay visible.
                touch ? "" : "opacity-0 group-hover:opacity-100",
              )}
              aria-label="Delete to-do"
            >
              <Trash2 className={touch ? "h-4 w-4" : "h-3.5 w-3.5"} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const JotBody = ({ size = "compact" }: { size?: PanelSize }) => {
  const { value: note, setValue: setNote } = useSyncedDraft("jot", DRAFT_KEY);
  const createIdea = useCreateIdea();
  const deleteIdea = useDeleteIdea();
  const { data: recentIdeas = [] } = useIdeas({ kind: "recent" });
  const savedJots = recentIdeas.filter((i) => i.source_type === "manual").slice(0, 30);

  const touch = size === "touch";

  const saveNote = async () => {
    const body = note.trim();
    if (!body) return;
    const [firstLine] = body.split("\n");
    try {
      await createIdea.mutateAsync({
        title: firstLine.slice(0, 80) || "Quick note",
        raw_note: body,
        source_type: "manual",
        folder_id: null,
      });
      setNote("");
      toast.success("Saved to your vault");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save note");
    }
  };

  return (
    <div className={cn("flex flex-col min-h-0 flex-1 gap-1.5", touch ? "p-3 gap-2" : "p-2")}>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void saveNote();
          }
        }}
        placeholder="Jot anything down…"
        className={cn(
          "shrink-0 w-full resize-none rounded-lg bg-white/[0.06] border border-white/12 leading-relaxed text-foreground placeholder:text-foreground/45 outline-none focus:border-primary/60",
          touch ? "h-[120px] px-3 py-2.5 text-[15px]" : "h-[96px] px-2.5 py-2 text-[12.5px]",
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-foreground/50">Autosaved</span>
        <button
          onClick={() => void saveNote()}
          disabled={!note.trim() || createIdea.isPending}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-primary/40 text-primary font-semibold hover:bg-primary/10 transition disabled:opacity-40",
            touch ? "h-11 px-4 text-[15px]" : "h-8 px-2.5 text-[12px]",
          )}
        >
          {createIdea.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </button>
      </div>

      <p className="text-[10.5px] uppercase tracking-wide text-foreground/45 px-0.5">Saved jots</p>
      <div className="min-h-0 flex-1 overflow-y-auto space-y-1">
        {savedJots.length === 0 && (
          <p className="text-[12px] text-foreground/55 px-0.5">Nothing saved yet.</p>
        )}
        {savedJots.map((idea) => (
          <div
            key={idea.id}
            className={cn(
              "group flex items-start gap-1.5 rounded-lg bg-white/[0.05] border border-white/10 hover:border-primary/40 transition",
              touch ? "px-3 py-2.5 gap-2" : "px-2 py-1.5",
            )}
          >
            <button
              onClick={() => setNote(idea.raw_note ?? idea.title)}
              className="flex-1 min-w-0 text-left"
              title="Load into the jot pad"
            >
              <span
                className={cn(
                  "block text-foreground/90 leading-snug line-clamp-1",
                  touch ? "text-[15px]" : "text-[12.5px]",
                )}
              >
                {idea.title}
              </span>
              {idea.raw_note && (
                <span
                  className={cn(
                    "block text-foreground/55 leading-snug line-clamp-2",
                    touch ? "text-[13px]" : "text-[11.5px]",
                  )}
                >
                  {idea.raw_note}
                </span>
              )}
            </button>
            <button
              onClick={() => deleteIdea.mutate(idea.id)}
              disabled={deleteIdea.isPending}
              className={cn(
                "mt-0.5 shrink-0 transition text-foreground/50 hover:text-destructive disabled:opacity-40",
                touch ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              )}
              aria-label={`Delete jot ${idea.title}`}
              title="Delete jot"
            >
              <Trash2 className={touch ? "h-4 w-4" : "h-3.5 w-3.5"} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
