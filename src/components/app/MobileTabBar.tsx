import { Inbox, Folder, Clock, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IdeaFilter } from "@/hooks/useIdeas";

type Props = {
  filter: IdeaFilter;
  onFilterChange: (f: IdeaFilter) => void;
  onOpenFolders: () => void;
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
 * iOS-style bottom tab bar. Four equal tabs: Ideas, Folders, History, Settings.
 * Folders opens the sidebar drawer (where folder list lives); Settings opens
 * a dedicated sheet handled by the parent.
 */
export const MobileTabBar = ({ filter, onFilterChange, onOpenFolders, onOpenSettings }: Props) => {
  const isAll = filter.kind === "all";
  const isFolders = filter.kind === "folder";
  const isHistory = filter.kind === "recent";

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/80 backdrop-blur-xl border-t border-border safe-bottom"
      aria-label="Primary"
    >
      <div className="flex items-stretch h-[50px]">
        <Tab active={isAll} icon={Inbox} label="Ideas" onClick={() => onFilterChange({ kind: "all" })} />
        <Tab active={isFolders} icon={Folder} label="Folders" onClick={onOpenFolders} />
        <Tab active={isHistory} icon={Clock} label="History" onClick={() => onFilterChange({ kind: "recent" })} />
        <Tab active={false} icon={SettingsIcon} label="Settings" onClick={onOpenSettings} />
      </div>
    </nav>
  );
};
