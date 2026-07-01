import { useEffect, useRef, useState } from "react";
import { Minus, X, Square, Copy } from "lucide-react";

/**
 * Windows-style window controls for the desktop phone widget.
 *
 * - Minimize: collapses to a compact taskbar pill at the bottom.
 * - Maximize/Restore: toggles phone-width (430px) vs full-width layout.
 * - Close: hides widget; a taskbar pill lets you reopen it.
 * - Drag: grab the titlebar (empty space or "IdeaVault" label) to reposition
 *   the whole widget. Position persists to localStorage and is clamped to
 *   the viewport. Double-click the titlebar to snap back to center.
 *
 * Only rendered on desktop (>= 768px). All state persists to localStorage.
 */
type Mode = "open" | "minimized" | "closed";

const STORAGE = "desktop-window-mode-v1";
const EXPAND_STORAGE = "desktop-window-expanded-v1";
const POS_STORAGE = "desktop-window-pos-v1";

const WIDGET_W = 430;
const TITLEBAR_H = 32;

export const DesktopWindowControls = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [mode, setMode] = useState<Mode>("open");
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    try {
      const m = localStorage.getItem(STORAGE) as Mode | null;
      if (m === "minimized" || m === "closed" || m === "open") setMode(m);
      setExpanded(localStorage.getItem(EXPAND_STORAGE) === "1");
      const raw = localStorage.getItem(POS_STORAGE);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number" && typeof p?.y === "number") setPos(p);
      }
    } catch { /* ignore */ }
  }, []);

  // Clamp position to viewport whenever it or the viewport changes.
  const clamp = (p: { x: number; y: number }) => {
    if (typeof window === "undefined") return p;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const halfExtraX = Math.max(0, (vw - WIDGET_W) / 2);
    // Allow dragging so the widget stays at least 80px on-screen.
    const minX = -halfExtraX - (WIDGET_W - 80);
    const maxX = halfExtraX + (WIDGET_W - 80);
    const minY = 0;
    const maxY = Math.max(0, vh - TITLEBAR_H - 40);
    return {
      x: Math.min(maxX, Math.max(minX, p.x)),
      y: Math.min(maxY, Math.max(minY, p.y)),
    };
  };

  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Apply state to <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (!isDesktop) {
      root.classList.remove(
        "desktop-minimized",
        "desktop-closed",
        "desktop-expanded",
        "desktop-dragging",
      );
      root.style.removeProperty("--dw-x");
      root.style.removeProperty("--dw-y");
      return;
    }
    try { localStorage.setItem(STORAGE, mode); } catch { /* ignore */ }
    try { localStorage.setItem(EXPAND_STORAGE, expanded ? "1" : "0"); } catch { /* ignore */ }
    try { localStorage.setItem(POS_STORAGE, JSON.stringify(pos)); } catch { /* ignore */ }

    root.classList.toggle("desktop-minimized", mode === "minimized");
    root.classList.toggle("desktop-closed", mode === "closed");
    root.classList.toggle("desktop-expanded", expanded && mode === "open");
    root.classList.toggle("desktop-dragging", dragging);

    // When maximized, ignore drag offset so it fills the viewport.
    const effX = expanded && mode === "open" ? 0 : pos.x;
    const effY = expanded && mode === "open" ? 0 : pos.y;
    root.style.setProperty("--dw-x", `${effX}px`);
    root.style.setProperty("--dw-y", `${effY}px`);
  }, [mode, expanded, isDesktop, pos, dragging]);

  // Pointer drag handlers.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore clicks on the window control buttons.
    if ((e.target as HTMLElement).closest("button")) return;
    if (expanded) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clamp({
      x: dragRef.current.origX + dx,
      y: dragRef.current.origY + dy,
    }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    dragRef.current = null;
    setDragging(false);
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    setPos({ x: 0, y: 0 });
  };

  if (!isDesktop) return null;

  if (mode === "closed") {
    return (
      <button
        onClick={() => setMode("open")}
        className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-6 px-4 h-10 rounded-md bg-black/70 backdrop-blur-xl text-white text-sm font-medium shadow-2xl border border-white/15 hover:bg-black/80 transition animate-fade-in"
        aria-label="Reopen widget"
      >
        Open IdeaVault
      </button>
    );
  }

  if (mode === "minimized") {
    return (
      <div className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-6 flex items-center h-10 rounded-md bg-black/70 backdrop-blur-xl text-white shadow-2xl border border-white/15 overflow-hidden animate-fade-in">
        <span className="text-sm font-medium tracking-tight px-4">IdeaVault</span>
        <WinBtn title="Restore" onClick={() => setMode("open")}>
          <Square className="h-3 w-3" strokeWidth={2} />
        </WinBtn>
        <WinBtn title="Close" onClick={() => setMode("closed")} danger>
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </WinBtn>
      </div>
    );
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      className={`fixed z-[100] flex items-center top-0 h-8 bg-black/60 backdrop-blur-xl border-b border-white/10 rounded-b-md overflow-hidden shadow-lg animate-fade-in select-none ${
        expanded ? "cursor-default" : dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        left: expanded ? "0px" : "max(0px, calc(50vw - 215px))",
        transform: expanded ? undefined : `translate(var(--dw-x, 0px), var(--dw-y, 0px))`,
        transition: dragging ? "none" : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        touchAction: "none",
      }}
      title={expanded ? undefined : "Drag to move · double-click to recenter"}
    >
      <span className="text-[11px] font-medium tracking-tight text-white/80 px-3 pointer-events-none">
        IdeaVault
      </span>
      <WinBtn title="Minimize" onClick={() => setMode("minimized")}>
        <Minus className="h-3.5 w-3.5" strokeWidth={2} />
      </WinBtn>
      <WinBtn
        title={expanded ? "Restore" : "Maximize"}
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? (
          <Copy className="h-3 w-3 -scale-x-100" strokeWidth={2} />
        ) : (
          <Square className="h-3 w-3" strokeWidth={2} />
        )}
      </WinBtn>
      <WinBtn title="Close" onClick={() => setMode("closed")} danger>
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </WinBtn>
    </div>
  );
};

const WinBtn = ({
  title,
  onClick,
  children,
  danger,
}: {
  title: string;
  onClick: () => void;
  children?: React.ReactNode;
  danger?: boolean;
}) => (
  <button
    onClick={onClick}
    onPointerDown={(e) => e.stopPropagation()}
    title={title}
    aria-label={title}
    className={`h-8 w-11 flex items-center justify-center text-white/80 transition ${
      danger ? "hover:bg-[#e81123] hover:text-white" : "hover:bg-white/10"
    }`}
  >
    {children}
  </button>
);
