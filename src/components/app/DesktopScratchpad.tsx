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
 * Open/closed state and the active tab persist to localStorage.
 */
const OPEN_KEY = "desktop-scratchpad-open-v1";
const TAB_KEY = "desktop-scratchpad-tab-v1";
const DRAFT_KEY = "desktop-scratchpad-draft-v1";

type Tab = "todo" | "jot";

export const DesktopScratchpad = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("todo");
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
      const storedTab = localStorage.getItem(TAB_KEY);
      if (storedTab === "todo" || storedTab === "jot") setTab(storedTab);
      setNote(localStorage.getItem(DRAFT_KEY) ?? "");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
      localStorage.setItem(TAB_KEY, tab);
    } catch { /* ignore */ }
  }, [open, tab]);

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
        className="fixed z-[95] right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 px-2 py-4 rounded-l-2xl glass-card-strong text-foreground/80 hover:text-foreground transition"
        aria-label="Open desktop scratchpad"
      >
        <CheckSquare className="h-4 w-4" />
        <span className="text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl]">
          Scratchpad{openTodos > 0 ? ` · ${openTodos}` : ""}
        </span>
      </button>,
      document.body,
    );
  }

  return createPortal(
    <aside
      className="fixed z-[95] right-4 top-1/2 -translate-y-1/2 w-[340px] max-h-[76vh] flex flex-col rounded-2xl glass-card-strong overflow-hidden shadow-2xl animate-fade-in"
      aria-label="Desktop scratchpad"
    >
      <div className="flex items-center gap-1 px-2 py-2 border-b border-white/10">
        <TabButton active={tab === "todo"} onClick={() => setTab("todo")}>
          <CheckSquare className="h-3.5 w-3.5" />
          To-do{openTodos > 0 ? ` · ${openTodos}` : ""}
        </TabButton>
        <TabButton active={tab === "jot"} onClick={() => setTab("jot")}>
          <NotebookPen className="h-3.5 w-3.5" />
          Jot
        </TabButton>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto h-8 w-8 inline-flex items-center justify-center text-foreground/60 hover:text-foreground transition"
          aria-label="Collapse scratchpad"
          title="Collapse"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {tab === "todo" ? (
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 p-2.5">
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
              className="flex-1 h-9 rounded-xl bg-white/[0.06] border border-white/12 px-3 text-[14px] text-foreground placeholder:text-foreground/45 outline-none focus:border-primary/60"
            />
            <button
              onClick={addTodo}
              disabled={!todoDraft.trim() || createTodo.isPending}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-primary/40 text-primary hover:bg-primary/10 transition disabled:opacity-40"
              aria-label="Add to-do"
            >
              {createTodo.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-2.5 pb-3 space-y-1.5">
            {isLoading && (
              <p className="text-[13px] text-foreground/60 px-1 py-2">Loading…</p>
            )}
            {!isLoading && todos.length === 0 && (
              <p className="text-[13px] text-foreground/60 px-1 py-2">
                Nothing here yet. Add the first thing you need to get done.
              </p>
            )}
            {todos.map((t) => (
              <div
                key={t.id}
                className="group flex items-start gap-2 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-2"
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
                    "flex-1 text-[14px] leading-snug break-words",
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
      ) : (
        <div className="flex flex-col p-2.5 gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void saveNote();
              }
            }}
            rows={10}
            placeholder="Jot anything down. It stays here until you save it to your vault."
            className="w-full resize-none rounded-xl bg-white/[0.06] border border-white/12 px-3 py-2.5 text-[14px] leading-relaxed text-foreground placeholder:text-foreground/45 outline-none focus:border-primary/60"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-foreground/50">Draft saves automatically</span>
            <button
              onClick={() => void saveNote()}
              disabled={!note.trim() || createIdea.isPending}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-xl border border-primary/40 text-primary text-[13px] font-semibold hover:bg-primary/10 transition disabled:opacity-40"
            >
              {createIdea.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save to vault
            </button>
          </div>
        </div>
      )}
    </aside>,
    document.body,
  );
};

const TabButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[13px] font-semibold transition",
      active
        ? "border border-primary/40 text-primary bg-primary/10"
        : "border border-transparent text-foreground/65 hover:text-foreground",
    )}
  >
    {children}
  </button>
);
