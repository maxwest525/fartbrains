import { Star, FileText, Link2, Mic, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIdeas, type Idea, type IdeaFilter } from "@/hooks/useIdeas";
import { Skeleton } from "@/components/ui/skeleton";

const sourceIcon = (s: Idea["source_type"]) => {
  if (s === "webpage") return Link2;
  if (s === "transcript") return MessageSquare;
  if (s === "audio") return Mic;
  return FileText;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
};

type Props = {
  filter: IdeaFilter;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export const IdeaList = ({ filter, selectedId, onSelect }: Props) => {
  const { data: ideas = [], isLoading } = useIdeas(filter);

  const heading =
    filter.kind === "all"
      ? "All ideas"
      : filter.kind === "favorites"
        ? "Favorites"
        : filter.kind === "recent"
          ? "Recent"
          : filter.kind === "search"
            ? `Search: "${filter.query}"`
            : "Folder";

  return (
    <div className="w-full md:w-96 md:shrink-0 md:border-r border-border bg-background h-full flex flex-col">
      <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border">
        <h2 className="text-lg font-semibold">{heading}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isLoading ? "Loading…" : `${ideas.length} idea${ideas.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {!isLoading && ideas.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No ideas here yet. Click <span className="font-medium">New idea</span> to capture one.
          </div>
        )}

        {ideas.map((idea) => {
          const Icon = sourceIcon(idea.source_type);
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
                "w-full text-left px-5 py-3 border-b border-border/60 hover:bg-muted/40 transition-colors",
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
    </div>
  );
};
