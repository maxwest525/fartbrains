import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { IdeaFilter } from "@/hooks/useIdeas";

type Props = {
  filter: IdeaFilter;
  /** Which top-level view is active. */
  view: "ideas" | "folders" | "calendar" | "graph";
  onFilterChange: (f: IdeaFilter) => void;
  onOpenFolders: () => void;
  onOpenCalendar: () => void;
  onOpenGraph: () => void;
  onOpenSettings: () => void;
};

const Tab = ({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full press relative"
    aria-label={label}
  >
    <span className="relative inline-flex items-center justify-center h-10 w-16">
      <MaterialIcon
        name={icon}
        filled={active}
        size={28}
        className={cn(
          "transition-colors duration-300",
          active ? "text-white" : "text-white/60"
        )}
        style={
          active
            ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 28" }
            : undefined
        }
      />
    </span>

    <span
      className={cn(
        "text-[11px] font-medium tracking-tight transition-colors duration-300",
        active ? "text-white" : "text-white/60"
      )}
    >
      {label}
    </span>
  </button>
);

/**
 * Gemini Glimmer bottom tab bar — frosted glass, Material Symbols Rounded,
 * tonal indicator pill behind the active icon.
 */
export const MobileTabBar = ({ filter, view, onFilterChange, onOpenFolders, onOpenCalendar, onOpenGraph, onOpenSettings }: Props) => {
  const isAll = view === "ideas" && filter.kind === "all";
  const isFolders = view === "folders";
  const isCalendar = view === "calendar";
  const isGraph = view === "graph";
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      document.body.style.setProperty("--mobile-tabbar-h", `${Math.ceil(h)}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      document.body.style.removeProperty("--mobile-tabbar-h");
    };
  }, []);

  return (
    <nav
      ref={navRef}
      className="md:hidden fixed bottom-0 inset-x-0 z-30"
      aria-label="Primary"
    >
      {/* Top hairline gradient */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div
        className="relative bg-black/40 backdrop-blur-2xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >

        <div className="flex items-stretch h-[72px]">
          <Tab active={isAll} icon="auto_awesome" label="Capture" onClick={() => onFilterChange({ kind: "all" })} />
          <Tab active={isGraph} icon="hub" label="Graph" onClick={onOpenGraph} />
          <Tab active={isCalendar} icon="calendar_month" label="Calendar" onClick={onOpenCalendar} />
          <Tab active={isFolders} icon="folder" label="Folders" onClick={onOpenFolders} />
          <Tab active={false} icon="tune" label="Settings" onClick={onOpenSettings} />
        </div>
      </div>
    </nav>

  );
};
