import { Instagram, FileText, Link2, Mic, Image as ImageIcon, Wand2, ListChecks, ClipboardPaste, Briefcase, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SourceKey = "instagram" | "note" | "link" | "list" | "transcript" | "project" | "voice" | "image" | "prompt";

type Tile = {
  key: SourceKey;
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon color, used when active. */
  tone: string;
  enabled: boolean;
};

const TILES: Tile[] = [
  { key: "note",      label: "Note",      icon: FileText,   tone: "text-foreground",  enabled: true  },
  { key: "project",   label: "Project",   icon: Briefcase,  tone: "text-primary",     enabled: true  },
  { key: "instagram", label: "Instagram", icon: Instagram,  tone: "text-primary",     enabled: true  },
  { key: "link",      label: "Link",      icon: Link2,      tone: "text-primary",     enabled: true  },
  { key: "list",      label: "List",      icon: ListChecks, tone: "text-primary",     enabled: true  },
  { key: "transcript",label: "Transcript",icon: ClipboardPaste, tone: "text-primary", enabled: true  },
  { key: "voice",     label: "Voice",     icon: Mic,        tone: "text-foreground",  enabled: false },
  { key: "image",     label: "Image",     icon: ImageIcon,  tone: "text-foreground",  enabled: false },
  { key: "prompt",    label: "Prompt",    icon: Wand2,      tone: "text-foreground",  enabled: false },
];

type Props = {
  value: SourceKey;
  onChange: (key: SourceKey) => void;
};

/**
 * Six-tile source picker for the New Idea dialog.
 * Mirrors the iOS reference design: a single rounded grid of 3×2 tiles where
 * the selected tile is filled with the primary color. Disabled tiles announce
 * themselves as "Coming soon" via a small label and a click handler upstream.
 */
export const SourcePicker = ({ value, onChange }: Props) => {
  return (
    <div className="-mx-1 overflow-x-auto no-scrollbar scroll-momentum md:mx-0 md:overflow-visible md:rounded-2xl md:bg-secondary/60 md:p-2">
      <div className="flex gap-2 px-1 md:grid md:grid-cols-3 md:px-0">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const active = value === tile.key && tile.enabled;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => onChange(tile.key)}
              aria-pressed={active}
              aria-disabled={!tile.enabled}
              className={cn(
                "press relative shrink-0 min-w-[86px] h-16 md:h-auto md:min-w-0 flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.55)]"
                  : "bg-card text-foreground hover:bg-card/80",
                !tile.enabled && "opacity-55"
              )}
            >
              <Icon
                className={cn("h-[21px] w-[21px] md:h-[22px] md:w-[22px]", active ? "text-primary-foreground" : tile.tone)}
                strokeWidth={1.8}
              />
              <span className="leading-none whitespace-nowrap">{tile.label}</span>
              {!tile.enabled && (
                <span className="absolute -top-1 right-1 text-[9px] uppercase tracking-wide font-semibold text-muted-foreground bg-background/80 px-1 rounded">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const isSourceEnabled = (key: SourceKey) =>
  TILES.find((t) => t.key === key)?.enabled ?? false;
