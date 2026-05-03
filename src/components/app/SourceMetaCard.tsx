import { ExternalLink, Globe, Instagram, Music2, Youtube, User, Mic, FileText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Idea, SourceMeta } from "@/hooks/useIdeas";

type Props = {
  idea: Pick<Idea, "source_type" | "source_url" | "source_label" | "source_meta" | "extracted_text">;
};

type Display = {
  Icon: LucideIcon;
  label: string;
  tone: string;
  desc: string;
};

const KIND_DISPLAY: Record<NonNullable<SourceMeta["kind"]>, Display> = {
  instagram: { Icon: Instagram, label: "Instagram", tone: "bg-pink-500/10 text-pink-500 border-pink-500/20",        desc: "Reel / post" },
  tiktok:    { Icon: Music2,    label: "TikTok",    tone: "bg-foreground/10 text-foreground border-border",         desc: "Short video" },
  youtube:   { Icon: Youtube,   label: "YouTube",   tone: "bg-red-500/10 text-red-500 border-red-500/20",            desc: "Video" },
  webpage:   { Icon: Globe,     label: "Webpage",   tone: "bg-primary/10 text-primary border-primary/20",            desc: "Article" },
};

const DEFAULT_DISPLAY: Display = {
  Icon: FileText,
  label: "Source",
  tone: "bg-muted text-muted-foreground border-border",
  desc: "",
};

const safeHost = (raw: string | null): string | null => {
  if (!raw) return null;
  try { return new URL(raw).hostname.replace(/^www\./, ""); } catch { return null; }
};

/**
 * Unified source header for the idea detail view. Reads `source_meta` JSON
 * (populated by URL captures) and renders a consistent badge + author/site +
 * thumbnail block regardless of platform. Falls back gracefully when an idea
 * was created before metadata was captured.
 */
export const SourceMetaCard = ({ idea }: Props) => {
  // Skip entirely for plain manual notes with no URL — nothing to show.
  if (idea.source_type === "manual" && !idea.source_url) return null;

  const meta: SourceMeta = idea.source_meta ?? {};
  const display = (meta.kind && KIND_DISPLAY[meta.kind]) || DEFAULT_DISPLAY;
  const Icon = display.Icon;

  const host = safeHost(idea.source_url);
  const siteName = meta.siteName || idea.source_label || display.label;
  const author = meta.author || null;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 overflow-hidden">
      <div className="flex gap-3 p-3 sm:p-4">
        {meta.thumbnail ? (
          <img
            src={meta.thumbnail}
            alt=""
            loading="lazy"
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover bg-muted shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className={cn("h-16 w-16 sm:h-20 sm:w-20 rounded-xl flex items-center justify-center shrink-0", display.tone)}>
            <Icon className="h-7 w-7" strokeWidth={1.8} />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
              display.tone
            )}>
              <Icon className="h-3 w-3" />
              {display.label}
            </span>
            {meta.hasTranscript && (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-accent">
                <Mic className="h-3 w-3" />
                Transcribed
              </span>
            )}
          </div>

          <div className="text-[13px] text-muted-foreground flex items-center gap-2 flex-wrap">
            {author && (
              <span className="inline-flex items-center gap-1 text-foreground font-medium">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {author}
              </span>
            )}
            {author && (siteName || host) && <span className="opacity-50">·</span>}
            {(siteName || host) && <span className="truncate">{siteName || host}</span>}
          </div>

          {idea.source_url && (
            <a
              href={idea.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12.5px] text-primary hover:underline truncate max-w-full"
              title={idea.source_url}
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{host ?? idea.source_url}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
