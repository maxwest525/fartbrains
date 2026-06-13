import { ExternalLink, Github, Link as LinkIcon, BookOpen, Youtube, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import {
  useIdeaReferences,
  useRefreshIdeaReferences,
  useAutoRefreshReferences,
  type IdeaReference,
} from "@/hooks/useIdeaReferences";

type Props = { ideaId: string };

const iconFor = (kind: string) => {
  switch (kind) {
    case "github_repo":
      return Github;
    case "channel":
    case "video":
      return Youtube;
    case "book":
    case "paper":
      return BookOpen;
    case "tool":
    case "product":
    case "site":
      return LinkIcon;
    default:
      return LinkIcon;
  }
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const IdeaReferences = ({ ideaId }: Props) => {
  const { data = [], isLoading } = useIdeaReferences(ideaId);
  const { refresh, running } = useRefreshIdeaReferences(ideaId);
  useAutoRefreshReferences(ideaId);

  // Hide entirely when there's nothing and nothing in flight.
  if (!isLoading && !running && data.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Links &amp; references
        </h3>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={running}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition disabled:opacity-50"
          title="Re-find links"
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {running ? "Finding…" : "Refresh"}
        </button>
      </div>

      {data.length === 0 && running ? (
        <div className="rounded-md border border-border/60 bg-muted/20 p-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Finding links for what you saved…
        </div>
      ) : (
        <ul className="space-y-1.5">
          {data.map((ref) => (
            <ReferenceRow key={ref.id} ref={ref} />
          ))}
        </ul>
      )}
    </section>
  );
};

const ReferenceRow = ({ ref }: { ref: IdeaReference }) => {
  const Icon = iconFor(ref.kind);
  return (
    <li>
      <a
        href={ref.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block rounded-md border border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border transition p-3"
      >
        <div className="flex items-start gap-3">
          <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-sm font-medium truncate">{ref.name}</div>
              {ref.source === "ai_guess" && (
                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60 shrink-0">
                  best guess
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">
              {hostOf(ref.url)}
              {ref.description ? ` · ${ref.description}` : ""}
            </div>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground mt-1 shrink-0" />
        </div>
      </a>
    </li>
  );
};
