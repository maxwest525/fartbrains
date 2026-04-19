import { useRef, useState } from "react";
import { Search, X, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app/AppSidebar";
import { IdeaList } from "@/components/app/IdeaList";
import { IdeaDetail } from "@/components/app/IdeaDetail";
import { NewIdeaDialog } from "@/components/app/NewIdeaDialog";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import type { IdeaFilter } from "@/hooks/useIdeas";

const Shell = () => {
  const [filter, setFilter] = useState<IdeaFilter>({ kind: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();
  const edgeSwipeRef = useRef<HTMLDivElement>(null);

  // Swipe-from-left-edge → open the sidebar drawer (mobile only, list view only).
  useSwipeGesture(edgeSwipeRef, {
    onSwipe: () => setDrawerOpen(true),
    direction: "right",
    edgeSize: 0, // the zone itself is the edge — fire on any rightward swipe inside it
    enabled: isMobile && !drawerOpen && selectedId === null && !newOpen,
  });

  const onSearch = (v: string) => {
    setSearchValue(v);
    if (v.trim()) setFilter({ kind: "search", query: v });
    else setFilter({ kind: "all" });
  };

  const clearSearch = () => {
    setSearchValue("");
    setFilter({ kind: "all" });
  };

  const handleFilterChange = (f: IdeaFilter) => {
    setFilter(f);
    if (f.kind !== "search") setSearchValue("");
    if (isMobile) setDrawerOpen(false);
  };

  const handleNewIdea = () => {
    setNewOpen(true);
    if (isMobile) setDrawerOpen(false);
  };

  const showDetailOnly = isMobile && selectedId !== null;

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative">
      {/* Left-edge swipe zone — opens drawer on mobile when no detail/dialog is open */}
      {isMobile && !drawerOpen && selectedId === null && !newOpen && (
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
              onNewIdea={handleNewIdea}
            />
          </SheetContent>
        </Sheet>
      ) : (
        <AppSidebar
          filter={filter}
          onFilterChange={handleFilterChange}
          onNewIdea={() => setNewOpen(true)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar — hidden on mobile when viewing a detail */}
        {!showDetailOnly && (
          <header className="safe-top sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
            <div className="px-3 sm:px-5 py-2.5 flex items-center gap-2 sm:gap-3">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 md:hidden"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <div className="relative flex-1 max-w-xl">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Search ideas…"
                  className="pl-9 pr-9 h-11 rounded-full bg-muted/60 border-transparent focus-visible:bg-background"
                />
                {searchValue && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground"
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
          {/* List: hidden on mobile when a detail is open */}
          {!showDetailOnly && (
            <IdeaList filter={filter} selectedId={selectedId} onSelect={setSelectedId} />
          )}
          {/* Detail: hidden on mobile when nothing is selected */}
          {(!isMobile || showDetailOnly) && (
            <IdeaDetail ideaId={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </div>
      </div>

      {/* Mobile bottom tab bar with center FAB */}
      {isMobile && !showDetailOnly && (
        <MobileTabBar
          filter={filter}
          onFilterChange={handleFilterChange}
          onOpenMenu={() => setDrawerOpen(true)}
          onNewIdea={handleNewIdea}
        />
      )}

      <NewIdeaDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultFolderId={filter.kind === "folder" ? filter.folderId : null}
        onCreated={(id) => setSelectedId(id)}
      />
    </div>
  );
};

const Index = () => (
  <ProtectedRoute>
    <Shell />
  </ProtectedRoute>
);

export default Index;
