import { Folder as FolderIcon, Plus, Bell, Inbox } from "lucide-react";
import { useState } from "react";
import { useFolders, useFolderCounts, useCreateFolder, type Folder } from "@/hooks/useFolders";
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
import { FolderReminderDialog } from "./FolderReminderDialog";
import { formatRelative, formatFull, formatReminder } from "@/lib/formatTime";

/** Stable hue per folder id so each chip carries its own accent color. */
const hashHue = (id: string): number => {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  const palette = [210, 250, 280, 320, 0, 18, 36, 158, 188];
  return palette[Math.abs(h) % palette.length];
};

type Props = {
  /** ID of the currently active folder, or null if none. */
  activeFolderId: string | null;
  onSelectFolder: (folderId: string) => void;
  /** Called when "All ideas" tile is tapped. */
  onSelectAll: () => void;
};

/**
 * Horizontal-scrolling row of folder tiles rendered inline at the top of the
 * ideas list. Shows folder name, idea count, last-activity timestamp and an
 * optional reminder bell. Long-press / right-click reveals the reminder
 * picker; first tile is "All ideas" and the trailing tile creates a new folder.
 */
export const FolderStrip = ({ activeFolderId, onSelectFolder, onSelectAll }: Props) => {
  const { data: folders = [], isLoading } = useFolders();
  const { data: counts = {} } = useFolderCounts();
  const createFolder = useCreateFolder();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [reminderTarget, setReminderTarget] = useState<Folder | null>(null);

  const submitCreate = async () => {
    if (!newName.trim()) return;
    await createFolder.mutateAsync(newName);
    setNewName("");
    setCreateOpen(false);
  };

  if (isLoading && folders.length === 0) return null;

  const totalIdeas = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="px-3 sm:px-5 pt-1 pb-2">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Folders
        </h3>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {folders.length} folder{folders.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="-mx-3 sm:-mx-5 px-3 sm:px-5 overflow-x-auto scroll-momentum no-scrollbar">
        <div className="flex items-stretch gap-2 pb-1 min-w-max">
          {/* All ideas tile */}
          <button
            onClick={onSelectAll}
            aria-pressed={activeFolderId === null}
            className={cn(
              "press relative shrink-0 w-[148px] rounded-xl border-2 text-left p-2.5 transition-all",
              activeFolderId === null
                ? "bg-primary/10 border-primary ring-2 ring-primary/25 shadow-sm"
                : "bg-card border-border/60 hover:border-border"
            )}
          >
            {activeFolderId === null && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" aria-hidden />
            )}
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-7 w-7 rounded-[8px] flex items-center justify-center shrink-0",
                activeFolderId === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-foreground/85 text-background"
              )}>
                <Inbox className="h-3.5 w-3.5" strokeWidth={2.4} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "font-semibold text-[13px] truncate leading-tight",
                  activeFolderId === null && "text-primary"
                )}>All ideas</p>
                <p className="text-[11px] text-muted-foreground tabular-nums leading-tight mt-0.5">
                  {activeFolderId === null ? `Viewing · ${totalIdeas}` : totalIdeas}
                </p>
              </div>
            </div>
          </button>

          {folders.map((folder) => {
            const count = counts[folder.id] ?? 0;
            const hue = hashHue(folder.id);
            const active = folder.id === activeFolderId;
            const overdue =
              folder.remind_at && new Date(folder.remind_at).getTime() <= Date.now();
            return (
              <div
                key={folder.id}
                aria-pressed={active}
                className={cn(
                  "relative shrink-0 w-[170px] rounded-xl transition-all",
                  active
                    ? "border-2 border-primary ring-2 ring-primary/25 shadow-md -translate-y-0.5"
                    : "border border-border/60 hover:border-border"
                )}
                style={{
                  background: active
                    ? `linear-gradient(155deg, hsl(${hue} 70% 92% / 0.85) 0%, hsl(var(--card)) 70%)`
                    : `linear-gradient(155deg, hsl(${hue} 70% 96% / 0.55) 0%, hsl(var(--card)) 60%)`,
                }}
              >
                {active && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full"
                    style={{ background: `hsl(${hue} 75% 50%)` }}
                    aria-hidden
                  />
                )}
                <button
                  onClick={() => onSelectFolder(folder.id)}
                  className="press w-full text-left p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-7 w-7 rounded-[8px] flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(140deg, hsl(${hue} 85% 62%) 0%, hsl(${hue} 75% 48%) 100%)`,
                        boxShadow: `0 4px 10px -4px hsl(${hue} 70% 45% / ${active ? 0.7 : 0.45})`,
                      }}
                    >
                      <FolderIcon
                        className="h-3.5 w-3.5 text-white"
                        strokeWidth={2.2}
                        fill="currentColor"
                        fillOpacity={0.18}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "font-semibold text-[13px] truncate leading-tight",
                        active && "text-foreground"
                      )}>
                        {folder.name}
                      </p>
                      <p className={cn(
                        "text-[11px] tabular-nums leading-tight mt-0.5",
                        active ? "font-medium" : "text-muted-foreground"
                      )}
                      style={active ? { color: `hsl(${hue} 60% 35%)` } : undefined}>
                        {active ? `Viewing · ${count}` : `${count} · ${formatRelative(folder.updated_at)}`}
                      </p>
                    </div>
                  </div>
                  {folder.remind_at && (
                    <div
                      className={cn(
                        "mt-1.5 inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded-md",
                        overdue
                          ? "bg-destructive/15 text-destructive"
                          : "bg-primary/10 text-primary"
                      )}
                      title={formatFull(folder.remind_at)}
                    >
                      <Bell className="h-2.5 w-2.5" strokeWidth={2.5} />
                      {formatReminder(folder.remind_at)}
                    </div>
                  )}
                </button>

                {/* Reminder bell (top-right) — sets/edits the schedule */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReminderTarget(folder);
                  }}
                  className={cn(
                    "absolute top-1 right-1 h-6 w-6 rounded-full flex items-center justify-center transition-colors",
                    folder.remind_at
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary"
                  )}
                  aria-label={folder.remind_at ? "Edit reminder" : "Set reminder"}
                  title={
                    folder.remind_at
                      ? `Reminder: ${formatFull(folder.remind_at)}`
                      : "Set a reminder"
                  }
                >
                  <Bell
                    className="h-3 w-3"
                    strokeWidth={2.4}
                    fill={folder.remind_at ? "currentColor" : "none"}
                    fillOpacity={folder.remind_at ? 0.25 : 0}
                  />
                </button>
              </div>
            );
          })}

          {/* New folder tile */}
          <button
            onClick={() => setCreateOpen(true)}
            className="press shrink-0 w-[120px] rounded-xl border border-dashed border-border/70 bg-background hover:border-primary/40 hover:bg-secondary/40 p-2.5 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="text-[12px] font-medium">New folder</span>
          </button>
        </div>
      </div>

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

      <FolderReminderDialog
        open={!!reminderTarget}
        onOpenChange={(v) => !v && setReminderTarget(null)}
        folder={reminderTarget}
      />
    </div>
  );
};
