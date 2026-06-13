import { useEffect, useRef } from "react";
import { Inbox, Folder, Clock, CalendarDays, Settings as SettingsIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { IdeaFilter } from "@/hooks/useIdeas";

type Props = {
  filter: IdeaFilter;
  /** Which top-level view is active. */
  view: "ideas" | "folders" | "calendar";
  onFilterChange: (f: IdeaFilter) => void;
  onOpenFolders: () => void;
  onOpenCalendar: () => void;
  onOpenSettings: () => void;
};

const Tab = ({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Inbox;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex-1 flex flex-col items-center justify-center gap-0.5 h-full press",
      active ? "text-primary" : "text-muted-foreground"
    )}
    aria-label={label}
  >
    <Icon className={cn("h-[22px] w-[22px]", active && "fill-primary/15")} strokeWidth={active ? 2.4 : 2} />
    <span className="text-[10px] font-medium tracking-tight">{label}</span>
  </button>
);

/**
 * iOS-style bottom tab bar. Five tabs: Capture, Recents, Calendar, Folders, Settings.
 */
export const MobileTabBar = ({ filter, view, onFilterChange, onOpenFolders, onOpenCalendar, onOpenSettings }: Props) => {
  const isAll = view === "ideas" && filter.kind === "all";
  const isFolders = view === "folders";
  const isCalendar = view === "calendar";
  const isHistory = view === "ideas" && filter.kind === "recent";

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/80 backdrop-blur-xl border-t border-border safe-bottom"
      aria-label="Primary"
    >
      <div className="flex items-stretch h-[50px]">
        <Tab active={isAll} icon={Inbox} label="Capture" onClick={() => onFilterChange({ kind: "all" })} />
        <Tab active={isHistory} icon={Clock} label="Recents" onClick={() => onFilterChange({ kind: "recent" })} />
        <Tab active={isCalendar} icon={CalendarDays} label="Calendar" onClick={onOpenCalendar} />
        <Tab active={isFolders} icon={Folder} label="Folders" onClick={onOpenFolders} />
        <Tab active={false} icon={SettingsIcon} label="Settings" onClick={onOpenSettings} />
      </div>
    </nav>
  );
};
