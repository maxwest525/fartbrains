import { useEffect, useRef, useState } from "react";
import { Folder, Plus, MoreHorizontal, Pencil, Trash2, ChevronLeft, Search, X, FileText, Globe, Mic, AudioLines, Loader2, Clock } from "lucide-react";

import {
  useFolders,
  useFolderCounts,
  useFolderPreviews,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
} from "@/hooks/useFolders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Map a folder id to a stable hue (0-360) so each tile gets its own color
 * accent without storing one in the DB. djb2-ish hash → curated palette.
 */
const hashHue = (id: string): number => {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) | 0;
  const palette = [210, 250, 280, 320, 0, 18, 36, 158, 188];
  return palette[Math.abs(h) % palette.length];
};

/** Tiny icon for the source type, used inside folder preview rows. */
const SourceIcon = ({
  type,
  className,
}: {
  type: "manual" | "webpage" | "transcript" | "audio";
  className?: string;
}) => {
  const Icon =
    type === "webpage" ? Globe : type === "transcript" ? Mic : type === "audio" ? AudioLines : FileText;
  return <Icon className={className} strokeWidth={2.2} />;
};

type Props = {
  /** Open a folder by id (parent navigates to the folder filter view). */
  onOpenFolder: (folderId: string) => void;
  /** Open the virtual "Recent" view. */
  onOpenRecent?: () => void;
  /** Mobile back action — desktop ignores this. */
  onBack?: () => void;
};


/**
 * iOS Files-style Folders page. Card grid with name, icon, and idea count.
 * Long-press / kebab menu exposes Rename + Delete. Top-right plus creates one.
 */
export const FoldersPage = ({ onOpenFolder, onOpenRecent, onBack }: Props) => {
  const { data: folders = [], isLoading } = useFolders();
  const { data: counts = {} } = useFolderCounts();
  const { data: previews = {} } = useFolderPreviews();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const isMobile = useIsMobile();

  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = folders.filter((f) =>
    f.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  // Seed the default folder set once when the user has none. The names map to
  // common capture types so the grid is never empty for a new account.
  const seededRef = useRef(false);
  useEffect(() => {
    if (isLoading || seededRef.current) return;
    const DEFAULTS = ["Ideas", "Notes", "Todo", "Checklists"];
    const existing = new Set(folders.map((f) => f.name.toLowerCase()));
    const missing = DEFAULTS.filter((n) => !existing.has(n.toLowerCase()));
    if (folders.length === 0 && missing.length === DEFAULTS.length) {
      seededRef.current = true;
      (async () => {
        for (const name of DEFAULTS) {
          try { await createFolder.mutateAsync(name); } catch { /* ignore */ }
        }
      })();
    }
  }, [isLoading, folders, createFolder]);


  const submitCreate = async () => {
    if (!newName.trim()) return;
    await createFolder.mutateAsync(newName);
    setNewName("");
    setCreateOpen(false);
  };

  const submitRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    await renameFolder.mutateAsync({ id: renameTarget.id, name: renameValue });
    setRenameTarget(null);
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    await deleteFolder.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden">
      {/* iOS-style nav bar */}
      <div className="safe-top shrink-0 z-10 bg-transparent px-1 sm:px-5 pt-0 pb-3">

        <div className="flex items-center min-h-[36px] gap-1 px-2 sm:px-0">
          {isMobile && onBack && (
            <button
              onClick={onBack}
              className="press flex items-center text-primary -ml-1 pl-1 pr-2 h-9 text-[17px]"
              aria-label="Back"
            >
              <ChevronLeft className="h-6 w-6 -mr-0.5" strokeWidth={2.4} />
              <span className="font-normal">Back</span>
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => setCreateOpen(true)}
            className="press h-9 w-9 flex items-center justify-center text-primary"
            aria-label="New folder"
          >
            <Plus className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </button>
        </div>
        <div className="px-3 sm:px-0 pt-1">
          <h1 className="text-[28px] md:text-2xl font-bold md:font-semibold tracking-tight leading-tight">
            Folders
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading folders…</span>
              </>
            ) : (
              <span>{folders.length} folder{folders.length === 1 ? "" : "s"}</span>
            )}
          </p>
        </div>
        {/* Search */}
        <div className="px-3 sm:px-0 pt-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search folders"
              className="pl-9 pr-9 h-9 rounded-[10px] bg-white/[0.04] border-transparent text-[15px]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-muted-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>


      {/* Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum touch-pan-y px-4 sm:px-6 py-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-8">
        {isLoading ? (
          <>
            <div className="flex items-center justify-center gap-2 text-[13px] text-muted-foreground mb-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading folders…</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-[180px] rounded-2xl bg-card border border-border/50 animate-pulse" />
              ))}
            </div>
          </>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-3">
              {query ? (
                <Search className="h-7 w-7 text-muted-foreground" />
              ) : (
                <Folder className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <p className="text-[15px] font-semibold text-foreground">
              {query ? "No matching folders" : "No folders yet"}
            </p>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-xs mx-auto">
              {query
                ? `Nothing matches "${query}". Try a different name.`
                : "Group related ideas together for easier browsing."}
            </p>
            {!query && (
              <Button
                variant="outline"
                className="mt-4 rounded-full"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Create folder
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {onOpenRecent && (query.trim() === "" || "recent".includes(query.trim().toLowerCase())) && (
              <div className="group relative transition-all duration-200 hover:-translate-y-0.5 rounded-2xl glass-card glass-card-interactive">
                <button
                  onClick={onOpenRecent}
                  className="press relative w-full text-left p-4 flex flex-col items-start gap-3 min-h-[180px]"
                >
                  <div className="flex items-center gap-3 w-full min-w-0">
                    <div className="relative h-11 w-11 flex items-center justify-center shrink-0">
                      <Clock className="h-7 w-7 text-foreground/85" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[15px] truncate leading-tight tracking-tight">
                        Recent
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-1">Recently captured</p>
                    </div>
                  </div>
                  <div className="w-full mt-1 flex-1 flex items-end">
                    <p className="text-[11.5px] text-muted-foreground/70 italic">
                      Your latest ideas across all folders
                    </p>
                  </div>
                </button>
              </div>
            )}

            {filtered.map((folder) => {
              const count = counts[folder.id] ?? 0;
              const folderPreviews = previews[folder.id] ?? [];
              return (
                <div
                  key={folder.id}
                  className="group relative transition-all duration-200 hover:-translate-y-0.5 rounded-2xl glass-card glass-card-interactive"
                >
                  <button
                    onClick={() => onOpenFolder(folder.id)}
                    className="press relative w-full text-left p-4 flex flex-col items-start gap-3 min-h-[180px]"
                  >
                    <div className="flex items-center gap-3 w-full min-w-0">
                      <div className="relative h-11 w-11 flex items-center justify-center shrink-0">
                        <Folder className="h-7 w-7 text-foreground/85" strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[15px] truncate leading-tight tracking-tight">
                          {folder.name}
                        </p>
                        <p className="text-[12px] text-muted-foreground tabular-nums mt-1">
                          {count} {count === 1 ? "idea" : "ideas"}
                        </p>
                      </div>
                    </div>

                    <div className="w-full mt-1 flex-1 flex flex-col gap-1">
                      {folderPreviews.length === 0 ? (
                        <div className="flex-1 flex items-center">
                          <p className="text-[12px] text-muted-foreground/70 italic">
                            Empty folder
                          </p>
                        </div>
                      ) : (
                        folderPreviews.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-1.5 px-0.5 py-0.5"
                          >
                            <SourceIcon
                              type={item.source_type}
                              className="h-3 w-3 shrink-0 text-muted-foreground"
                            />
                            <span className="text-[11.5px] truncate leading-tight text-foreground/80">
                              {item.title}
                            </span>
                          </div>
                        ))
                      )}
                      {count > folderPreviews.length && folderPreviews.length > 0 && (
                        <p className="text-[10.5px] text-muted-foreground/70 pl-1.5 pt-0.5">
                          +{count - folderPreviews.length} more
                        </p>
                      )}
                    </div>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:data-[state=open]:opacity-100 transition-opacity"
                      aria-label="Folder actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameTarget({ id: folder.id, name: folder.name });
                          setRenameValue(folder.name);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteTarget({ id: folder.id, name: folder.name })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
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

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription className="sr-only">Change the folder name.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
            }}
            className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitRename}
              disabled={!renameValue.trim() || renameFolder.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Ideas inside this folder will move back to All ideas. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
