import { useEffect, useState } from "react";
import { Minus, X, Square, Copy } from "lucide-react";

/**
 * Windows-style window controls for the desktop phone widget.
 *
 * - Minimize: collapses to a compact taskbar pill at the bottom.
 * - Maximize/Restore: toggles phone-width (430px) vs full-width layout.
 * - Close: hides widget; a taskbar pill lets you reopen it.
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
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!isDesktop) {
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

  if (mode === "closed") {
    return (
      <button
        onClick={() => setMode("open")}
        className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-6 px-4 h-10 rounded-md bg-black/70 backdrop-blur-xl text-white text-sm font-medium shadow-2xl border border-white/15 hover:bg-black/80 transition"
        aria-label="Reopen widget"
      >
        Open IdeaVault
      </button>
    );
  }

  if (mode === "minimized") {
    return (
      <div className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-6 flex items-center h-10 rounded-md bg-black/70 backdrop-blur-xl text-white shadow-2xl border border-white/15 overflow-hidden">
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
      className="fixed z-[100] flex items-center top-0 h-8 bg-black/60 backdrop-blur-xl border-b border-white/10 rounded-b-md overflow-hidden shadow-lg"
      style={{
        left: expanded ? "0px" : "max(0px, calc(50vw - 215px))",
      }}
    >
      <span className="text-[11px] font-medium tracking-tight text-white/80 px-3">
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
    title={title}
    aria-label={title}
    className={`h-8 w-11 flex items-center justify-center text-white/80 transition ${
      danger ? "hover:bg-[#e81123] hover:text-white" : "hover:bg-white/10"
    }`}
  >
    {children}
  </button>
);
