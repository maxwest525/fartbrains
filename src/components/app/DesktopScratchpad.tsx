import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckSquare, ChevronDown, ChevronRight, NotebookPen, Plus, Trash2, Loader2, PanelRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTodos, useCreateTodo, useToggleTodo, useDeleteTodo } from "@/hooks/useTodos";
import { useCreateIdea, useIdeas } from "@/hooks/useIdeas";

/**
 * Desktop split view (>= 768px): a resizable right-hand column that shows the
 * to-do list and the jot pad at the same time, while the phone frame (with the
 * Ash composer) is shifted left so nothing ever overlaps.
 *
 * Rendered through a portal onto <body> so it anchors to the desktop viewport
 * instead of the 430px phone frame. Panel width, the split between the two
 * panels, and which panels are open all persist to localStorage.
 */
const OPEN_KEY = "desktop-split-open-v1";
const WIDTH_KEY = "desktop-split-width-v1";
const RATIO_KEY = "desktop-split-ratio-v1";
const TODO_OPEN_KEY = "desktop-split-todo-open-v1";
const JOT_OPEN_KEY = "desktop-split-jot-open-v1";
const DRAFT_KEY = "desktop-scratchpad-draft-v1";

const MIN_W = 240;
const MAX_W = 520;
const DEFAULT_W = 320;
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

const readNumber = (key: string, fallback: number) => {
  try {
    const raw = localStorage.getItem(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch { return fallback; }
};

const readBool = (key: string, fallback: boolean) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "1";
  } catch { return fallback; }
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const DesktopScratchpad = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(true);
  const [width, setWidth] = useState(DEFAULT_W);
  const [ratio, setRatio] = useState(0.5);
  const [todoOpen, setTodoOpen] = useState(true);
  const [jotOpen, setJotOpen] = useState(true);
  const [todoDraft, setTodoDraft] = useState("");
  const [note, setNote] = useState("");
  const columnRef = useRef<HTMLDivElement>(null);

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

  // Restore persisted layout once on mount.
  useEffect(() => {
    setOpen(readBool(OPEN_KEY, true));
    setWidth(clamp(readNumber(WIDTH_KEY, DEFAULT_W), MIN_W, MAX_W));
    setRatio(clamp(readNumber(RATIO_KEY, 0.5), MIN_RATIO, MAX_RATIO));
    setTodoOpen(readBool(TODO_OPEN_KEY, true));
    setJotOpen(readBool(JOT_OPEN_KEY, true));
    try { setNote(localStorage.getItem(DRAFT_KEY) ?? ""); } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Persist layout choices.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
      localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
      localStorage.setItem(RATIO_KEY, ratio.toFixed(3));
      localStorage.setItem(TODO_OPEN_KEY, todoOpen ? "1" : "0");
      localStorage.setItem(JOT_OPEN_KEY, jotOpen ? "1" : "0");
    } catch { /* ignore */ }
  }, [hydrated, open, width, ratio, todoOpen, jotOpen]);

  // Keep the scratchpad draft across reloads so nothing is ever lost.
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(DRAFT_KEY, note); } catch { /* ignore */ }
  }, [hydrated, note]);

  // Reserve space so the phone frame slides left instead of sitting underneath.
  useEffect(() => {
    const root = document.documentElement;
    const reserve = isDesktop && open ? width + 24 : 0;
    root.style.setProperty("--split-reserve", `${reserve}px`);
    return () => root.style.setProperty("--split-reserve", "0px");
  }, [isDesktop, open, width]);

  const startWidthDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: PointerEvent) => {
      setWidth(clamp(startW + (startX - ev.clientX), MIN_W, MAX_W));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [width]);

  const startRatioDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const box = columnRef.current?.getBoundingClientRect();
    if (!box) return;
    const onMove = (ev: PointerEvent) => {
      setRatio(clamp((ev.clientY - box.top) / box.height, MIN_RATIO, MAX_RATIO));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

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
        aria-label="Open desktop panels"
      >
        <PanelRight className="h-3.5 w-3.5" />
        <span>Notes{openTodos > 0 ? ` · ${openTodos}` : ""}</span>
      </button>,
      document.body,
    );
  }

  // Both panels open → share the column by the persisted ratio.
  const bothOpen = todoOpen && jotOpen;

  return createPortal(
    <aside
      className="fixed z-[95] right-3 top-3 bottom-3 flex rounded-2xl glass-card-strong overflow-hidden shadow-2xl animate-fade-in"
      style={{ width }}
      aria-label="Desktop panels"
    >
      {/* Width resize handle */}
      <div
        onPointerDown={startWidthDrag}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel width"
        className="w-1.5 shrink-0 cursor-col-resize hover:bg-primary/40 transition"
      />

      <div ref={columnRef} className="flex-1 min-w-0 flex flex-col">
        {/* To-do panel */}
        <section
          className="flex flex-col min-h-0"
          style={bothOpen ? { flex: `${ratio} 1 0%` } : todoOpen ? { flex: "1 1 0%" } : undefined}
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/10">
            <button
              onClick={() => setTodoOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-foreground transition"
              aria-expanded={todoOpen}
            >
              {todoOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11.5px] font-semibold">
                To-do{openTodos > 0 ? ` · ${openTodos}` : ""}
              </span>
            </button>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto h-6 w-6 inline-flex items-center justify-center text-foreground/60 hover:text-foreground transition"
              aria-label="Hide desktop panels"
              title="Hide"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {todoOpen && (
            <div className="flex flex-col min-h-0 flex-1">
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

              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 space-y-1">
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
          )}
        </section>

        {/* Split handle between the two panels */}
        {bothOpen && (
          <div
            onPointerDown={startRatioDrag}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize panels"
            className="h-1.5 shrink-0 cursor-row-resize bg-white/10 hover:bg-primary/40 transition"
          />
        )}

        {/* Jot panel */}
        <section
          className="flex flex-col min-h-0"
          style={bothOpen ? { flex: `${1 - ratio} 1 0%` } : jotOpen ? { flex: "1 1 0%" } : undefined}
        >
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-y border-white/10">
            <button
              onClick={() => setJotOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-foreground transition"
              aria-expanded={jotOpen}
            >
              {jotOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <NotebookPen className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11.5px] font-semibold">Jot</span>
            </button>
          </div>

          {jotOpen && (
            <div className="flex flex-col min-h-0 flex-1 p-2 gap-1.5">
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
                className="h-[96px] shrink-0 w-full resize-none rounded-lg bg-white/[0.06] border border-white/12 px-2.5 py-2 text-[12.5px] leading-relaxed text-foreground placeholder:text-foreground/45 outline-none focus:border-primary/60"
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

              {/* Saved jots */}
              <p className="text-[10.5px] uppercase tracking-wide text-foreground/45 px-0.5">Saved jots</p>
              <div className="min-h-0 flex-1 overflow-y-auto space-y-1">
                {savedJots.length === 0 && (
                  <p className="text-[12px] text-foreground/55 px-0.5">Nothing saved yet.</p>
                )}
                {savedJots.map((idea) => (
                  <button
                    key={idea.id}
                    onClick={() => setNote(idea.raw_note ?? idea.title)}
                    className="w-full text-left rounded-lg bg-white/[0.05] border border-white/10 px-2 py-1.5 hover:border-primary/40 transition"
                    title="Load into the jot pad"
                  >
                    <span className="block text-[12.5px] text-foreground/90 leading-snug line-clamp-1">{idea.title}</span>
                    {idea.raw_note && (
                      <span className="block text-[11.5px] text-foreground/55 leading-snug line-clamp-2">
                        {idea.raw_note}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

        </section>
      </div>
    </aside>,
    document.body,
  );
};
