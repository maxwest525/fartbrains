import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckSquare, ChevronRight, NotebookPen, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo } from "@/hooks/useTodos";
import { useCreateIdea } from "@/hooks/useIdeas";

/**
 * Always-on desktop side panel (>= 768px) for the two things you want at
 * arm's reach on a big screen: a to-do list and a scratchpad for quick jots.
 *
 * Rendered through a portal onto <body> so it anchors to the desktop viewport
 * instead of the 430px phone frame (#root creates its own containing block).
 * Open/closed state persists to localStorage.
 */
const OPEN_KEY = "desktop-scratchpad-open-v1";
const DRAFT_KEY = "desktop-scratchpad-draft-v1";

export const DesktopScratchpad = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const [todoDraft, setTodoDraft] = useState("");
  const [note, setNote] = useState("");

  const { data: todos = [], isLoading } = useTodos();
  const createTodo = useCreateTodo();
  const toggleTodo = useToggleTodo();
  const deleteTodo = useDeleteTodo();
  const createIdea = useCreateIdea();

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    try {
      const storedOpen = localStorage.getItem(OPEN_KEY);
      if (storedOpen !== null) setOpen(storedOpen === "1");
      setNote(localStorage.getItem(DRAFT_KEY) ?? "");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch { /* ignore */ }
  }, [open]);

  // Keep the scratchpad draft across reloads so nothing is ever lost.
  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, note); } catch { /* ignore */ }
  }, [note]);

  const addTodo = () => {
    const value = todoDraft.trim();
    if (!value) return;
    createTodo.mutate(value, { onSuccess: () => setTodoDraft("") });
  };

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

  if (!isDesktop) return null;

  const openTodos = todos.filter((t) => !t.done).length;

  if (!open) {
    return createPortal(
      <button
        onClick={() => setOpen(true)}
        className="fixed z-[95] right-3 top-3 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full glass-card-strong text-foreground/80 hover:text-foreground transition text-[11px] font-semibold"
        aria-label="Open desktop scratchpad"
      >
        <CheckSquare className="h-3.5 w-3.5" />
        <span>Notes{openTodos > 0 ? ` · ${openTodos}` : ""}</span>
      </button>,
      document.body,
    );
  }

  return createPortal(
    <aside
      className="fixed z-[95] right-3 top-3 w-[264px] max-h-[72vh] flex flex-col rounded-2xl glass-card-strong overflow-hidden shadow-2xl animate-fade-in"
      aria-label="Desktop scratchpad"
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/10">
        <CheckSquare className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11.5px] font-semibold text-foreground/80">
          To-do{openTodos > 0 ? ` · ${openTodos}` : ""}
        </span>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto h-6 w-6 inline-flex items-center justify-center text-foreground/60 hover:text-foreground transition"
          aria-label="Collapse scratchpad"
          title="Collapse"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* To-dos */}
      <div className="flex flex-col min-h-0">
        <div className="flex items-center gap-1.5 p-2">
          <input
            value={todoDraft}
            onChange={(e) => setTodoDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTodo();
              }
            }}
            placeholder="Something to do…"
            className="flex-1 h-8 rounded-lg bg-white/[0.06] border border-white/12 px-2.5 text-[12.5px] text-foreground placeholder:text-foreground/45 outline-none focus:border-primary/60"
          />
          <button
            onClick={addTodo}
            disabled={!todoDraft.trim() || createTodo.isPending}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition disabled:opacity-40"
            aria-label="Add to-do"
          >
            {createTodo.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </button>
        </div>

        <div className="min-h-0 max-h-[30vh] overflow-y-auto px-2 pb-2 space-y-1">
          {isLoading && (
            <p className="text-[12px] text-foreground/60 px-1 py-1.5">Loading…</p>
          )}
          {!isLoading && todos.length === 0 && (
            <p className="text-[12px] text-foreground/60 px-1 py-1.5">Nothing yet.</p>
          )}
          {todos.map((t) => (
            <div
              key={t.id}
              className="group flex items-start gap-2 rounded-lg bg-white/[0.05] border border-white/10 px-2 py-1.5"
            >
              <button
                onClick={() => toggleTodo.mutate({ id: t.id, done: !t.done })}
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 rounded-[5px] border transition inline-flex items-center justify-center",
                  t.done ? "border-primary bg-primary/20 text-primary" : "border-white/30",
                )}
                aria-label={t.done ? "Mark as not done" : "Mark as done"}
              >
                {t.done && <CheckSquare className="h-3 w-3" />}
              </button>
              <span
                className={cn(
                  "flex-1 text-[12.5px] leading-snug break-words",
                  t.done ? "text-foreground/45 line-through" : "text-foreground/90",
                )}
              >
                {t.title}
              </span>
              <button
                onClick={() => deleteTodo.mutate(t.id)}
                className="opacity-0 group-hover:opacity-100 transition text-foreground/50 hover:text-destructive"
                aria-label="Delete to-do"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Jot */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-y border-white/10">
        <NotebookPen className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11.5px] font-semibold text-foreground/80">Jot</span>
      </div>
      <div className="flex flex-col p-2 gap-1.5">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void saveNote();
            }
          }}
          rows={5}
          placeholder="Jot anything down…"
          className="w-full resize-none rounded-lg bg-white/[0.06] border border-white/12 px-2.5 py-2 text-[12.5px] leading-relaxed text-foreground placeholder:text-foreground/45 outline-none focus:border-primary/60"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] text-foreground/50">Autosaved</span>
          <button
            onClick={() => void saveNote()}
            disabled={!note.trim() || createIdea.isPending}
            className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-primary/40 text-primary text-[12px] font-semibold hover:bg-primary/10 transition disabled:opacity-40"
          >
            {createIdea.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </aside>,
    document.body,
  );
};

