import { useEffect, useState } from "react";
import { Minus, X, Maximize2, Minimize2 } from "lucide-react";

/**
 * macOS-style traffic lights for the desktop phone widget.
 *
 * - Close: hides the widget entirely; a floating pill lets you reopen it.
 * - Minimize: collapses the widget into a compact title bar at the bottom.
 * - Expand: toggles the widget between phone-width (430px) and full-width
 *   desktop layout by adding `.desktop-expanded` on <html>.
 *
 * Only rendered on desktop (>= 768px). All state persists to localStorage.
 */
type Mode = "open" | "minimized" | "closed";

const STORAGE = "desktop-window-mode-v1";
const EXPAND_STORAGE = "desktop-window-expanded-v1";

export const DesktopWindowControls = () => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [mode, setMode] = useState<Mode>("open");
  const [expanded, setExpanded] = useState(false);

  // Track desktop breakpoint.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Restore state.
  useEffect(() => {
    try {
      const m = localStorage.getItem(STORAGE) as Mode | null;
      if (m === "minimized" || m === "closed" || m === "open") setMode(m);
      setExpanded(localStorage.getItem(EXPAND_STORAGE) === "1");
    } catch { /* ignore */ }
  }, []);

  // Persist + apply body/html classes so CSS can react.
  useEffect(() => {
    if (!isDesktop) {
      // On mobile viewports, force the widget open and clear any classes.
      document.documentElement.classList.remove(
        "desktop-minimized",
        "desktop-closed",
        "desktop-expanded",
      );
      return;
    }
    try { localStorage.setItem(STORAGE, mode); } catch { /* ignore */ }
    try { localStorage.setItem(EXPAND_STORAGE, expanded ? "1" : "0"); } catch { /* ignore */ }
    const root = document.documentElement;
    root.classList.toggle("desktop-minimized", mode === "minimized");
    root.classList.toggle("desktop-closed", mode === "closed");
    root.classList.toggle("desktop-expanded", expanded && mode === "open");
  }, [mode, expanded, isDesktop]);

  if (!isDesktop) return null;

  // Reopen affordance when closed.
  if (mode === "closed") {
    return (
      <button
        onClick={() => setMode("open")}
        className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-6 px-4 h-10 rounded-full bg-black/70 backdrop-blur-xl text-white text-sm font-medium shadow-2xl border border-white/15 hover:bg-black/80 transition"
        aria-label="Reopen widget"
      >
        Open IdeaVault
      </button>
    );
  }

  // Minimized bar at bottom.
  if (mode === "minimized") {
    return (
      <div className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-6 flex items-center gap-3 pl-4 pr-2 h-11 rounded-full bg-black/70 backdrop-blur-xl text-white shadow-2xl border border-white/15">
        <span className="text-sm font-medium tracking-tight">IdeaVault</span>
        <div className="flex items-center gap-1.5">
          <TrafficLight color="#febc2e" title="Restore" onClick={() => setMode("open")}>
            <Maximize2 className="h-2.5 w-2.5 text-black/70" strokeWidth={3} />
          </TrafficLight>
          <TrafficLight color="#ff5f57" title="Close" onClick={() => setMode("closed")}>
            <X className="h-2.5 w-2.5 text-black/70" strokeWidth={3} />
          </TrafficLight>
        </div>
      </div>
    );
  }

  // Open: overlay the traffic lights on top-left of the widget.
  return (
    <div
      className="fixed z-[100] flex items-center gap-2 top-3 group"
      style={{
        left: expanded
          ? "12px"
          : "max(12px, calc(50vw - 215px + 12px))",
      }}
    >
      <TrafficLight color="#ff5f57" title="Close" onClick={() => setMode("closed")}>
        <X className="h-2 w-2 text-black/70 opacity-0 group-hover:opacity-100" strokeWidth={3} />
      </TrafficLight>
      <TrafficLight color="#febc2e" title="Minimize" onClick={() => setMode("minimized")}>
        <Minus className="h-2 w-2 text-black/70 opacity-0 group-hover:opacity-100" strokeWidth={3} />
      </TrafficLight>
      <TrafficLight
        color="#28c840"
        title={expanded ? "Shrink to phone width" : "Expand to full width"}
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? (
          <Minimize2 className="h-2 w-2 text-black/70 opacity-0 group-hover:opacity-100" strokeWidth={3} />
        ) : (
          <Maximize2 className="h-2 w-2 text-black/70 opacity-0 group-hover:opacity-100" strokeWidth={3} />
        )}
      </TrafficLight>
    </div>
  );
};

const TrafficLight = ({
  color,
  title,
  onClick,
  children,
}: {
  color: string;
  title: string;
  onClick: () => void;
  children?: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className="h-3.5 w-3.5 rounded-full flex items-center justify-center ring-1 ring-black/20 hover:brightness-110 active:brightness-90 transition"
    style={{ backgroundColor: color }}
  >
    {children}
  </button>
);
