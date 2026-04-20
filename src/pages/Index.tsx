import { useRef, useState } from "react";
import { Search, X, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app/AppSidebar";
import { IdeaList } from "@/components/app/IdeaList";
import { IdeaDetail } from "@/components/app/IdeaDetail";
import { ComposeIdea } from "@/components/app/ComposeIdea";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { FoldersPage } from "@/components/app/FoldersPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import type { IdeaFilter } from "@/hooks/useIdeas";

type View = "ideas" | "folders";

const Shell = () => {
  const [view, setView] = useState<View>("ideas");
  const [filter, setFilter] = useState<IdeaFilter>({ kind: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMobile = useIsMobile();
  const edgeSwipeRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLDivElement>(null);

  // Swipe-from-left-edge → open the sidebar drawer (mobile only, list view only).
  useSwipeGesture(edgeSwipeRef, {
    onSwipe: () => setDrawerOpen(true),
    direction: "right",
    edgeSize: 0,
    enabled: isMobile && !drawerOpen && selectedId === null && view === "ideas",
  });

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
    if (isMobile) setDrawerOpen(false);
  };

  // Sidebar's "New idea" just scrolls the compose card into view.
  const focusCompose = () => {
    setView("ideas");
    if (isMobile) setDrawerOpen(false);
    requestAnimationFrame(() => {
      composeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      composeRef.current?.querySelector<HTMLElement>("input,textarea")?.focus();
    });
  };

  const openFoldersPage = () => {
    setView("folders");
    setSelectedId(null);
    if (isMobile) setDrawerOpen(false);
  };

  const showDetailOnly = isMobile && selectedId !== null;
  const showFolders = view === "folders" && !showDetailOnly;
  const defaultFolderId = filter.kind === "folder" ? filter.folderId : null;

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative">
      {/* Left-edge swipe zone — opens drawer on mobile when no detail is open */}
      {isMobile && !drawerOpen && selectedId === null && view === "ideas" && (
        <div
          ref={edgeSwipeRef}
          className="md:hidden fixed left-0 top-0 bottom-0 w-3 z-40"
          aria-hidden="true"
        />
      )}

      {/* Sidebar — drawer on mobile, fixed on desktop */}
      {isMobile ? (
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="p-0 w-80 max-w-[85vw]">
            <AppSidebar
              filter={filter}
              onFilterChange={handleFilterChange}
              onNewIdea={focusCompose}
              onOpenFolders={openFoldersPage}
              foldersActive={view === "folders"}
            />
          </SheetContent>
        </Sheet>
      ) : (
        <AppSidebar
          filter={filter}
          onFilterChange={handleFilterChange}
          onNewIdea={focusCompose}
          onOpenFolders={openFoldersPage}
          foldersActive={view === "folders"}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — hidden on mobile when viewing a detail or the folders page (folders has its own header) */}
        {!showDetailOnly && !(isMobile && showFolders) && (
          <header className="safe-top sticky top-0 z-20 bg-background/80 backdrop-blur-xl md:border-b border-border">
            <div className="px-3 sm:px-5 py-2 flex items-center gap-2 sm:gap-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 md:hidden text-primary"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-[22px] w-[22px]" />
                </Button>
              )}
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
                />
              </div>
            </div>
          )}

          {/* Detail — desktop always shows, mobile only when an idea is selected */}
          {!showFolders && (!isMobile || showDetailOnly) && (
            <IdeaDetail ideaId={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </div>
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
