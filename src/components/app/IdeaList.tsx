import { Star, FileText, Link2, Mic, MessageSquare, ChevronRight, Loader2, ChevronLeft, Inbox, Search as SearchIcon, Folder as FolderIcon, Clock as ClockIcon, Briefcase } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useIdeas, type Idea, type IdeaFilter } from "@/hooks/useIdeas";
import { useFolders } from "@/hooks/useFolders";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { FolderStrip } from "./FolderStrip";
import { PROJECT_TAG, deliverableStats } from "@/lib/deliverables";

const sourceMeta = (s: Idea["source_type"]) => {
  // iOS-style colored squircles per source type
  if (s === "webpage")    return { Icon: Link2,         tone: "bg-[hsl(211_100%_50%)] text-white" };
  if (s === "transcript") return { Icon: MessageSquare, tone: "bg-[hsl(140_70%_45%)] text-white" };
  if (s === "audio")      return { Icon: Mic,           tone: "bg-[hsl(28_100%_55%)] text-white" };
  return { Icon: FileText, tone: "bg-[hsl(240_6%_60%)] text-white" };
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

type Props = {
  filter: IdeaFilter;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Optional — shown only when viewing a folder, lets the user jump back to the Folders page. */
  onBackToFolders?: () => void;
  /** Change the active filter from the inline folder strip. */
  onFilterChange?: (filter: IdeaFilter) => void;
  /** Mobile can let the page own scrolling so compose + list move together. */
  pageScroll?: boolean;
};

export const IdeaList = ({ filter, selectedId, onSelect, onBackToFolders, onFilterChange, pageScroll = false }: Props) => {
  const { data: ideas = [], isLoading } = useIdeas(filter);
  const { data: folders = [] } = useFolders();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  // Pull-to-refresh — only on mobile, refetches the active ideas query.
  const { bind, pull, refreshing, threshold } = usePullToRefresh<HTMLDivElement>({
    enabled: isMobile && !pageScroll,
    onRefresh: async () => {
      await qc.invalidateQueries({ queryKey: ["ideas"] });
    },
  });

  const ready = pull >= threshold || refreshing;

  const folderName =
    filter.kind === "folder"
      ? (folders.find((f) => f.id === filter.folderId)?.name ?? "Folder")
      : null;

  const heading =
    filter.kind === "all"
      ? "Ideas"
      : filter.kind === "favorites"
        ? "Favorites"
        : filter.kind === "recent"
          ? "Recent"
          : filter.kind === "search"
            ? `"${filter.query}"`
            : (folderName ?? "Folder");

  return (
    <div className={cn("w-full flex flex-col bg-background", pageScroll ? "h-auto" : "h-full")}>
      {/* iOS large title (mobile only). Desktop keeps the compact label. */}
      <div className="px-4 sm:px-5 pt-2 pb-2 md:py-4 md:border-b border-border">
        {filter.kind === "folder" && onBackToFolders && (
          <button
            onClick={onBackToFolders}
            className="press -ml-2 mb-1 inline-flex items-center text-primary text-[15px] md:text-sm h-8 pl-1 pr-2"
            aria-label="Back to Folders"
          >
            <ChevronLeft className="h-5 w-5 -mr-0.5" strokeWidth={2.4} />
            <span>Folders</span>
          </button>
        )}
        <h2 className="text-[28px] leading-tight md:text-lg font-bold md:font-semibold tracking-tight">
          {heading}
        </h2>
        <p className="text-[13px] md:text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Loading ideas…</span>
            </>
          ) : (
            <span>{ideas.length} idea{ideas.length === 1 ? "" : "s"}</span>
          )}
        </p>
      </div>

      <div
        {...bind}
        className={cn(
          "px-0 relative",
          pageScroll
            ? "overflow-visible pb-3"
            : "flex-1 min-h-0 overflow-y-auto scroll-momentum touch-pan-y pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0"
        )}
      >
        {/* Pull-to-refresh indicator (mobile only). Sits above the content and
            follows the finger; locks at threshold while refreshing. */}
        {isMobile && (pull > 0 || refreshing) && (
          <div
            className="absolute left-0 right-0 top-0 flex items-start justify-center pointer-events-none z-10"
            style={{ height: pull, transition: refreshing ? "height 180ms ease" : undefined }}
          >
            <div
              className="mt-2 h-8 w-8 rounded-full bg-card shadow-md flex items-center justify-center"
              style={{
                opacity: Math.min(1, pull / threshold),
                transform: refreshing ? "none" : `rotate(${Math.min(360, (pull / threshold) * 360)}deg)`,
                transition: refreshing ? "transform 180ms ease" : undefined,
              }}
            >
              <Loader2
                className={cn(
                  "h-4 w-4 text-primary",
                  refreshing && "animate-spin",
                  ready && !refreshing && "text-primary"
                )}
              />
            </div>
          </div>
        )}

        {/* Content shifts down with the pull so the spinner has room. */}
        <div
          style={{
            transform: isMobile && pull > 0 ? `translateY(${pull}px)` : undefined,
            transition: refreshing ? "transform 180ms ease" : undefined,
          }}
        >
        {/* Desktop-only folder shortcuts. Mobile keeps folders in the Folders tab. */}
        {!isMobile && filter.kind !== "search" && onFilterChange && (
          <FolderStrip
            activeFolderId={filter.kind === "folder" ? filter.folderId : null}
            onSelectFolder={(folderId) => onFilterChange({ kind: "folder", folderId })}
            onSelectAll={() => onFilterChange({ kind: "all" })}
          />
        )}
        {isLoading && (
          <div className="px-4 md:px-4 pt-3 space-y-3 md:space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl md:rounded-md" />
            ))}
          </div>
        )}

        {!isLoading && ideas.length === 0 && (() => {
          const empty = (() => {
            switch (filter.kind) {
              case "favorites":
                return { Icon: Star, title: "No favorites yet", body: "Tap the star on an idea to pin it here." };
              case "recent":
                return { Icon: ClockIcon, title: "Nothing recent", body: "Ideas you create or edit will show up here." };
              case "search":
                return { Icon: SearchIcon, title: "No matches", body: `Nothing found for "${filter.query}". Try a different keyword.` };
              case "folder":
                return { Icon: FolderIcon, title: "Empty folder", body: "Capture an idea and assign it to this folder." };
              default:
                return { Icon: Inbox, title: "No ideas yet", body: "Tap Capture idea to add your first one." };
            }
          })();
          const Icon = empty.Icon;
          return (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-[15px] font-semibold text-foreground">{empty.title}</p>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-xs mx-auto">{empty.body}</p>
            </div>
          );
        })()}

        {/* Mobile: iOS grouped inset list. Desktop: flat row list. */}
        {ideas.length > 0 && (
          <>
            {/* MOBILE — grouped inset card with hairline separators */}
            <div className="md:hidden px-4 pt-1">
              <div className="rounded-2xl bg-card overflow-hidden ios-separator-inset">
                {ideas.map((idea) => {
                  const { Icon, tone } = sourceMeta(idea.source_type);
                  const preview =
                    idea.ai_summary?.replace(/[#*]/g, "").trim() ||
                    idea.raw_note ||
                    idea.extracted_text ||
                    "";
                  return (
                    <button
                      key={idea.id}
                      onClick={() => onSelect(idea.id)}
                      className="row-press w-full text-left flex items-start gap-3 px-3.5 py-2.5 min-h-[60px] active:bg-secondary"
                    >
                      <div className={cn("h-9 w-9 rounded-[8px] flex items-center justify-center shrink-0 mt-0.5", tone)}>
                        <Icon className="h-[18px] w-[18px]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-[16px] flex-1 truncate leading-tight">
                            {idea.title}
                          </h3>
                          {idea.is_favorite && (
                            <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" />
                          )}
                          <span className="text-[13px] text-muted-foreground shrink-0">
                            {formatDate(idea.updated_at)}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0 -mr-1" />
                        </div>
                        {preview && (
                          <p className="text-[14px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                            {preview}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DESKTOP — flat list */}
            <div className="hidden md:block">
              {ideas.map((idea) => {
                const { Icon } = sourceMeta(idea.source_type);
                const active = idea.id === selectedId;
                const preview =
                  idea.ai_summary?.replace(/[#*]/g, "").trim() ||
                  idea.raw_note ||
                  idea.extracted_text ||
                  "";
                return (
                  <button
                    key={idea.id}
                    onClick={() => onSelect(idea.id)}
                    className={cn(
                      "w-full text-left min-h-[64px] transition-colors",
                      "border-b border-border/60 px-5 py-3.5",
                      "hover:bg-muted/40",
                      active && "bg-muted"
                    )}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <h3 className="font-medium text-sm flex-1 truncate">{idea.title}</h3>
                      {idea.is_favorite && (
                        <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">{preview}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{formatDate(idea.updated_at)}</span>
                      {idea.tags.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="truncate">{idea.tags.slice(0, 3).join(", ")}</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
};
