import { Star, FileText, Link2, Mic, MessageSquare, ChevronRight, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useIdeas, type Idea, type IdeaFilter } from "@/hooks/useIdeas";
import { Skeleton } from "@/components/ui/skeleton";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useIsMobile } from "@/hooks/use-mobile";

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
};

export const IdeaList = ({ filter, selectedId, onSelect }: Props) => {
  const { data: ideas = [], isLoading } = useIdeas(filter);
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  // Pull-to-refresh — only on mobile, refetches the active ideas query.
  const { bind, pull, refreshing, threshold } = usePullToRefresh<HTMLDivElement>({
    enabled: isMobile,
    onRefresh: async () => {
      await qc.invalidateQueries({ queryKey: ["ideas"] });
    },
  });

  const ready = pull >= threshold || refreshing;

  const heading =
    filter.kind === "all"
      ? "Ideas"
      : filter.kind === "favorites"
        ? "Favorites"
        : filter.kind === "recent"
          ? "Recent"
          : filter.kind === "search"
            ? `"${filter.query}"`
            : "Folder";

  return (
    <div className="w-full md:w-96 md:shrink-0 md:border-r border-border bg-background h-full flex flex-col">
      {/* iOS large title (mobile only). Desktop keeps the compact label. */}
      <div className="px-4 sm:px-5 pt-2 pb-2 md:py-4 md:border-b border-border">
        <h2 className="text-[34px] leading-tight md:text-lg font-bold md:font-semibold tracking-tight">
          {heading}
        </h2>
        <p className="text-[13px] md:text-xs text-muted-foreground mt-0.5">
          {isLoading ? "Loading…" : `${ideas.length} idea${ideas.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div
        {...bind}
        className="flex-1 overflow-y-auto scroll-momentum px-0 pb-28 md:pb-0 relative"
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
        {isLoading && (
          <div className="px-4 md:px-4 pt-3 space-y-3 md:space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl md:rounded-md" />
            ))}
          </div>
        )}

        {!isLoading && ideas.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No ideas here yet. Tap <span className="font-medium">＋</span> to capture one.
          </div>
        )}

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
  );
};
