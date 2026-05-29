import { Folder as FolderIcon, Plus, Star, FileText, Link2, Mic, MessageSquare, ChevronRight, Inbox } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useFolders, useFolderCounts, useCreateFolder } from "@/hooks/useFolders";
import { useIdeas, type Idea, type IdeaFilter } from "@/hooks/useIdeas";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PushEnableBanner } from "./PushEnableBanner";

/** Stable hue per folder id so each tile carries its own accent color. */
const hashHue = (id: string): number => {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  const palette = [210, 250, 280, 320, 0, 18, 36, 158, 188];
  return palette[Math.abs(h) % palette.length];
};

const sourceMeta = (s: Idea["source_type"]) => {
  if (s === "webpage")    return { Icon: Link2,         tone: "bg-[hsl(211_100%_50%)] text-white" };
  if (s === "transcript") return { Icon: MessageSquare, tone: "bg-[hsl(140_70%_45%)] text-white" };
  if (s === "audio")      return { Icon: Mic,           tone: "bg-[hsl(28_100%_55%)] text-white" };
  return { Icon: FileText, tone: "bg-[hsl(240_6%_60%)] text-white" };
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

type Props = {
  onOpenFolder: (folderId: string) => void;
  onSelectIdea: (id: string) => void;
  /** Inline capture UI rendered below folders on mobile home. */
  captureSlot?: ReactNode;
  /** Switch the parent filter to "recent" when "See all" is tapped. */
  onSeeAllRecent: () => void;
  /** Open the full "All ideas" list (used by the All tile and section link). */
  onSeeAllIdeas: () => void;
};

/**
 * Mobile home screen: folders-first.
 * Shows a 2-col folder grid with idea counts, plus a "Recent" preview
 * of the 3 most recently updated ideas. The full ideas list lives behind
 * the "All ideas" link / Ideas tab.
 */
export const MobileHome = ({ captureSlot, onOpenFolder, onSelectIdea, onSeeAllRecent, onSeeAllIdeas }: Props) => {
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const { data: counts = {} } = useFolderCounts();
  const recentFilter: IdeaFilter = { kind: "recent" };
  const { data: ideas = [], isLoading: ideasLoading } = useIdeas(recentFilter);
  const createFolder = useCreateFolder();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const recent = ideas.slice(0, 3);
  const totalIdeas = Object.values(counts).reduce((a, b) => a + b, 0);

  const submitCreate = async () => {
    if (!newName.trim()) return;
    await createFolder.mutateAsync(newName);
    setNewName("");
    setCreateOpen(false);
  };

  return (
    <div className="px-4 pt-4 pb-2 space-y-5">
      <PushEnableBanner />
      {/* Folders section */}
      <section>
        <div className="flex items-end justify-between mb-3 px-0.5">
          <div>
            <h2 className="text-[30px] font-bold tracking-tight leading-none">Folders</h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              {folders.length} folder{folders.length === 1 ? "" : "s"} · {totalIdeas} idea{totalIdeas === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={onSeeAllIdeas}
            className="press text-[15px] font-medium text-primary px-1 h-9"
          >
            All ideas
          </button>
        </div>

        {foldersLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-[96px] rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* All ideas tile — first so the unfiled inbox is always one tap away. */}
            <button
              onClick={onSeeAllIdeas}
              className="press relative rounded-2xl overflow-hidden p-3 text-left min-h-[96px] flex flex-col justify-between bg-primary text-primary-foreground"
              style={{
                boxShadow:
                  "0 1px 0 hsl(0 0% 100% / 0.12) inset, 0 8px 20px -12px hsl(var(--primary) / 0.55), 0 1px 2px hsl(0 0% 0% / 0.06)",
              }}
            >
              <div className="relative h-9 w-9 rounded-[10px] flex items-center justify-center bg-white/15">
                <Inbox className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </div>
              <div className="relative">
                <p className="font-semibold text-[15px] truncate leading-tight tracking-tight">
                  All ideas
                </p>
                <p className="text-[12px] text-primary-foreground/80 tabular-nums mt-0.5">
                  {totalIdeas} {totalIdeas === 1 ? "idea" : "ideas"}
                </p>
              </div>
            </button>

            {folders.map((folder) => {
              const count = counts[folder.id] ?? 0;
              const hue = hashHue(folder.id);
              return (
                <button
                  key={folder.id}
                  onClick={() => onOpenFolder(folder.id)}
                  className="press relative rounded-2xl overflow-hidden p-3 text-left min-h-[96px] flex flex-col justify-between"
                  style={{
                    background: `linear-gradient(155deg, hsl(${hue} 70% 96% / 0.9) 0%, hsl(var(--card)) 60%)`,
                    boxShadow:
                      "0 1px 0 hsl(0 0% 100% / 0.06) inset, 0 6px 18px -12px hsl(0 0% 0% / 0.25), 0 1px 2px hsl(0 0% 0% / 0.04)",
                  }}
                >
                  <div className="absolute inset-0 rounded-2xl border border-border/50 pointer-events-none" />
                  <div
                    className="relative h-9 w-9 rounded-[10px] flex items-center justify-center"
                    style={{
                      background: `linear-gradient(140deg, hsl(${hue} 85% 62%) 0%, hsl(${hue} 75% 48%) 100%)`,
                      boxShadow: `0 6px 14px -4px hsl(${hue} 70% 45% / 0.45), 0 1px 0 hsl(0 0% 100% / 0.35) inset`,
                    }}
                  >
                    <FolderIcon
                      className="h-[18px] w-[18px] text-white"
                      strokeWidth={2}
                      fill="currentColor"
                      fillOpacity={0.18}
                    />
                  </div>
                  <div className="relative">
                    <p className="font-semibold text-[15px] truncate leading-tight tracking-tight">
                      {folder.name}
                    </p>
                    <p className="text-[12px] text-muted-foreground tabular-nums mt-0.5">
                      {count} {count === 1 ? "idea" : "ideas"}
                    </p>
                  </div>
                </button>
              );
            })}

            {/* New folder tile */}
            <button
              onClick={() => setCreateOpen(true)}
              className="press rounded-2xl border border-dashed border-border/70 bg-background hover:border-primary/40 hover:bg-secondary/40 min-h-[96px] flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[13px] font-medium">New folder</span>
            </button>
          </div>
        )}
      </section>

      {captureSlot && <section>{captureSlot}</section>}

      {/* Recent section */}
      <section>
        <div className="flex items-end justify-between mb-2 px-0.5">
          <h2 className="text-[22px] font-bold tracking-tight leading-tight">Recent</h2>
          {recent.length > 0 && (
            <button
              onClick={onSeeAllRecent}
              className="press text-[13px] font-medium text-primary px-1 h-8"
            >
              See all
            </button>
          )}
        </div>

        {ideasLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border/60 p-6 text-center">
            <p className="text-[14px] text-muted-foreground">
              Capture an idea above to see it here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-card overflow-hidden ios-separator-inset">
            {recent.map((idea) => {
              const { Icon, tone } = sourceMeta(idea.source_type);
              const preview =
                idea.ai_summary?.replace(/[#*]/g, "").trim() ||
                idea.raw_note ||
                idea.extracted_text ||
                "";
              return (
                <button
                  key={idea.id}
                  onClick={() => onSelectIdea(idea.id)}
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
        )}
      </section>

      {/* Create folder dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>Group related ideas together.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
            }}
            placeholder="Folder name"
            className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCreate} disabled={!newName.trim() || createFolder.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
