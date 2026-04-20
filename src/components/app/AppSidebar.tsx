import { useState } from "react";
import { Folder, Star, Clock, Inbox, Plus, MoreHorizontal, Trash2, Pencil, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFolders, useCreateFolder, useDeleteFolder, useRenameFolder } from "@/hooks/useFolders";
import { cn } from "@/lib/utils";
import type { IdeaFilter } from "@/hooks/useIdeas";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  filter: IdeaFilter;
  onFilterChange: (f: IdeaFilter) => void;
  onNewIdea: () => void;
  /** Open the dedicated Folders page (Files-style grid). */
  onOpenFolders?: () => void;
  /** Highlights the Folders nav item when the parent is on the folders page. */
  foldersActive?: boolean;
};

export const AppSidebar = ({ filter, onFilterChange, onNewIdea, onOpenFolders, foldersActive }: Props) => {
  const { data: folders = [] } = useFolders();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const renameFolder = useRenameFolder();
  const { user, signOut } = useAuth();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    await createFolder.mutateAsync(newName);
    setNewName("");
    setCreating(false);
  };

  const submitRename = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue.trim()) return;
    await renameFolder.mutateAsync({ id, name: renameValue });
    setRenamingId(null);
  };

  const isActive = (f: IdeaFilter) => JSON.stringify(f) === JSON.stringify(filter);

  const NavBtn = ({
    f,
    icon: Icon,
    label,
  }: {
    f: IdeaFilter;
    icon: typeof Folder;
    label: string;
  }) => (
    <button
      onClick={() => onFilterChange(f)}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
        isActive(f)
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <aside className="w-full md:w-64 shrink-0 border-r border-sidebar-border bg-sidebar h-full flex flex-col">
      <div className="safe-top p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
            IV
          </div>
          <span className="font-semibold text-sidebar-foreground">Idea Vault</span>
        </div>
        <Button onClick={onNewIdea} className="w-full h-11 rounded-full">
          <Plus className="h-4 w-4 mr-1" /> New idea
        </Button>
      </div>

      <nav className="p-2 space-y-1">
        <NavBtn f={{ kind: "all" }} icon={Inbox} label="All ideas" />
        <NavBtn f={{ kind: "favorites" }} icon={Star} label="Favorites" />
        <NavBtn f={{ kind: "recent" }} icon={Clock} label="Recent" />
        {onOpenFolders && (
          <button
            onClick={onOpenFolders}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              foldersActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60"
            )}
          >
            <Folder className="h-4 w-4 shrink-0" />
            <span className="truncate">Folders</span>
          </button>
        )}
      </nav>

      <div className="px-4 pt-4 pb-1 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Folders</span>
        <button
          onClick={() => setCreating(true)}
          className="h-9 w-9 -mr-2 flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="New folder"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {creating && (
          <form onSubmit={submitNew} className="px-1 py-1">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={() => {
                if (!newName.trim()) setCreating(false);
              }}
              placeholder="Folder name"
              className="h-8 text-sm"
            />
          </form>
        )}
        {folders.map((folder) => {
          const active = isActive({ kind: "folder", folderId: folder.id });
          return (
            <div
              key={folder.id}
              className={cn(
                "group flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-sm",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/60"
              )}
            >
              {renamingId === folder.id ? (
                <form onSubmit={(e) => submitRename(folder.id, e)} className="flex-1">
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => setRenamingId(null)}
                    className="h-9 text-sm"
                  />
                </form>
              ) : (
                <>
                  <button
                    onClick={() => onFilterChange({ kind: "folder", folderId: folder.id })}
                    className="flex items-center gap-2 flex-1 min-w-0 min-h-[40px]"
                  >
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="truncate">{folder.name}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 md:data-[state=open]:opacity-100"
                      aria-label="Folder actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setRenamingId(folder.id);
                          setRenameValue(folder.name);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete folder "${folder.name}"? Ideas inside will move to All.`)) {
                            deleteFolder.mutate(folder.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          );
        })}
        {folders.length === 0 && !creating && (
          <p className="px-3 py-2 text-xs text-muted-foreground">No folders yet</p>
        )}
      </div>

      <div className="p-3 border-t border-sidebar-border flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
};
