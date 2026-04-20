import { Inbox, Star, Clock, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IdeaFilter } from "@/hooks/useIdeas";

type Props = {
  filter: IdeaFilter;
  onFilterChange: (f: IdeaFilter) => void;
  onOpenMenu: () => void;
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
 * iOS-style bottom tab bar. Frosted blur, hairline top border, four equal tabs.
 * The "+" capture action lives as a separate floating action button so the bar
 * itself stays clean and recognizably iOS.
 */
export const MobileTabBar = ({ filter, onFilterChange, onOpenMenu }: Props) => {
  const isAll = filter.kind === "all";
  const isFav = filter.kind === "favorites";
  const isRecent = filter.kind === "recent";

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background/80 backdrop-blur-xl border-t border-border safe-bottom"
      aria-label="Primary"
    >
      <div className="flex items-stretch h-[50px]">
        <Tab active={isAll} icon={Inbox} label="Ideas" onClick={() => onFilterChange({ kind: "all" })} />
        <Tab active={isRecent} icon={Clock} label="Recent" onClick={() => onFilterChange({ kind: "recent" })} />
        <Tab active={isFav} icon={Star} label="Favorites" onClick={() => onFilterChange({ kind: "favorites" })} />
        <Tab active={false} icon={Menu} label="More" onClick={onOpenMenu} />
      </div>
    </nav>
  );
};
