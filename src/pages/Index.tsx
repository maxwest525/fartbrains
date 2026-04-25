import { useRef, useState } from "react";
import { Search, X, Inbox, Folder, Star, Clock, Settings as SettingsIcon, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { IdeaList } from "@/components/app/IdeaList";
import { IdeaDetail } from "@/components/app/IdeaDetail";
import { ComposeIdea } from "@/components/app/ComposeIdea";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { MobileHome } from "@/components/app/MobileHome";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { FoldersPage } from "@/components/app/FoldersPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useReminderNotifier } from "@/hooks/useReminderNotifier";
import { cn } from "@/lib/utils";
import type { IdeaFilter } from "@/hooks/useIdeas";

type View = "ideas" | "folders";

const Shell = () => {
  const [view, setView] = useState<View>("ideas");
  const [filter, setFilter] = useState<IdeaFilter>({ kind: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMobile = useIsMobile();
  const composeRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  // Polls folders client-side; fires browser + toast notifications when due.
  useReminderNotifier();

  const onSearch = (v: string) => {
    setSearchValue(v);
    if (v.trim()) {
      setView("ideas");
      setFilter({ kind: "search", query: v });
    } else {
      setFilter({ kind: "all" });
    }
  };

  const clearSearch = () => {
    setSearchValue("");
    setFilter({ kind: "all" });
  };

  const handleFilterChange = (f: IdeaFilter) => {
    setView("ideas");
    setFilter(f);
    if (f.kind !== "search") setSearchValue("");
  };

  const openFoldersPage = () => {
    setView("folders");
    setSelectedId(null);
  };

  const showDetailOnly = isMobile && selectedId !== null;
  const showFolders = view === "folders" && !showDetailOnly;
  const defaultFolderId = filter.kind === "folder" ? filter.folderId : null;

  // Desktop top-bar nav items.
  const navItems: Array<{
    label: string;
    icon: typeof Inbox;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      label: "Ideas",
      icon: Inbox,
      active: view === "ideas" && filter.kind === "all",
      onClick: () => handleFilterChange({ kind: "all" }),
    },
    {
      label: "Folders",
      icon: Folder,
      active: view === "folders",
      onClick: openFoldersPage,
    },
    {
      label: "Favorites",
      icon: Star,
      active: view === "ideas" && filter.kind === "favorites",
      onClick: () => handleFilterChange({ kind: "favorites" }),
    },
    {
      label: "Recent",
      icon: Clock,
      active: view === "ideas" && filter.kind === "recent",
      onClick: () => handleFilterChange({ kind: "recent" }),
    },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden relative">
      {/* Top bar — search + (desktop) inline nav. Hidden on mobile when viewing detail or the folders page (folders has its own header). */}
      {!showDetailOnly && !(isMobile && showFolders) && (
        <header className="safe-top sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="px-3 sm:px-5 py-2 flex items-center gap-2 sm:gap-3">
            {/* Brand — desktop only */}
            <div className="hidden md:flex items-center gap-2 shrink-0 pr-2">
              <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                IV
              </div>
              <span className="font-semibold">Idea Vault</span>
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-xl">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search"
                className="pl-9 pr-9 h-9 rounded-[10px] bg-secondary border-transparent focus-visible:bg-card text-[15px]"
              />
              {searchValue && (
                <button
                  onClick={clearSearch}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Desktop nav — replaces the old sidebar */}
            <nav className="hidden md:flex items-center gap-1 ml-auto">
              {navItems.map(({ label, icon: Icon, active, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
              <button
                onClick={() => setSettingsOpen(true)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                aria-label="Settings"
                title={user?.email ?? "Settings"}
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
              <button
                onClick={signOut}
                className="inline-flex items-center justify-center h-9 w-9 rounded-[10px] text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </nav>
          </div>
        </header>
      )}

      <div className="flex-1 flex min-h-0">
        {/* Folders page — full-width when active */}
        {showFolders && (
          <FoldersPage
            onOpenFolder={(folderId) => {
              setView("ideas");
              setFilter({ kind: "folder", folderId });
            }}
            onBack={isMobile ? () => setView("ideas") : undefined}
          />
        )}

        {/* Ideas view — compose + list. Hidden on mobile when detail is open or folders page is showing. */}
        {!showFolders && !showDetailOnly && (
          <div className="w-full md:w-[28rem] md:shrink-0 md:border-r border-border flex flex-col min-h-0 bg-background">
            <div ref={composeRef} className="px-3 sm:px-5 pt-3 pb-2 shrink-0">
              <ComposeIdea
                defaultFolderId={defaultFolderId}
                onCreated={(id) => setSelectedId(id)}
                onOpenExisting={(id) => setSelectedId(id)}
              />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <IdeaList
                filter={filter}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onBackToFolders={openFoldersPage}
                onFilterChange={handleFilterChange}
              />
            </div>
          </div>
        )}

        {/* Detail — desktop always shows, mobile only when an idea is selected */}
        {!showFolders && (!isMobile || showDetailOnly) && (
          <IdeaDetail ideaId={selectedId} onClose={() => setSelectedId(null)} />
        )}
      </div>

      {/* Mobile bottom tab bar (iOS-style) */}
      {isMobile && !showDetailOnly && (
        <MobileTabBar
          filter={filter}
          view={view}
          onFilterChange={handleFilterChange}
          onOpenFolders={openFoldersPage}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
};

const Index = () => (
  <ProtectedRoute>
    <Shell />
  </ProtectedRoute>
);

export default Index;
