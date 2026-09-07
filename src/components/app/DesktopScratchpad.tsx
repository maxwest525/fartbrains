import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckSquare, ChevronDown, ChevronRight, NotebookPen, PanelRight,
} from "lucide-react";
import { useTodos } from "@/hooks/useTodos";
import { JotBody, TodoBody } from "@/components/app/scratchpad/panels";

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
  const columnRef = useRef<HTMLDivElement>(null);

  // Only for the open-count badge; the list itself lives in <TodoBody />.
  const { data: todos = [] } = useTodos();


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

          {todoOpen && <TodoBody />}

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

          {jotOpen && <JotBody />}

        </section>
      </div>
    </aside>,
    document.body,
  );
};
