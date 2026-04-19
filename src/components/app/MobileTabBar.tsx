import { Inbox, Star, Clock, Menu, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IdeaFilter } from "@/hooks/useIdeas";

type Props = {
  filter: IdeaFilter;
  onFilterChange: (f: IdeaFilter) => void;
  onOpenMenu: () => void;
  onNewIdea: () => void;
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
    <Icon className={cn("h-5 w-5", active && "fill-primary/10")} />
    <span className="text-[10px] font-medium tracking-tight">{label}</span>
  </button>
);

export const MobileTabBar = ({ filter, onFilterChange, onOpenMenu, onNewIdea }: Props) => {
  const isAll = filter.kind === "all";
  const isFav = filter.kind === "favorites";
  const isRecent = filter.kind === "recent";

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t border-border safe-bottom"
      aria-label="Primary"
    >
      <div className="relative flex items-stretch h-14">
        <Tab active={isAll} icon={Inbox} label="Ideas" onClick={() => onFilterChange({ kind: "all" })} />
        <Tab active={isRecent} icon={Clock} label="Recent" onClick={() => onFilterChange({ kind: "recent" })} />

        {/* Center FAB */}
        <div className="w-16 flex items-start justify-center">
          <button
            onClick={onNewIdea}
            aria-label="New idea"
            className="press -mt-5 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center ring-4 ring-background"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        <Tab active={isFav} icon={Star} label="Favorites" onClick={() => onFilterChange({ kind: "favorites" })} />
        <Tab active={false} icon={Menu} label="Menu" onClick={onOpenMenu} />
      </div>
    </nav>
  );
};
