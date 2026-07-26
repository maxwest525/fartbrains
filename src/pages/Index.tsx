import { useEffect, useState } from "react";
import { Search, X, Inbox, Folder, Star, Clock, CalendarDays, Settings as SettingsIcon, LogOut } from "lucide-react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { Input } from "@/components/ui/input";
import { IdeaList } from "@/components/app/IdeaList";
import { IdeaDetail } from "@/components/app/IdeaDetail";
import { VoiceOrb } from "@/components/app/VoiceOrb";
import { UrlCaptureScreen } from "@/components/app/UrlCaptureScreen";
import { ComposeIdea } from "@/components/app/ComposeIdea";



import { MobileTabBar } from "@/components/app/MobileTabBar";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { FoldersPage } from "@/components/app/FoldersPage";
import { CalendarPage } from "@/components/app/CalendarPage";
import { GraphPage } from "@/components/app/GraphPage";
import { AlarmOverlay } from "@/components/app/AlarmOverlay";
import { AshDock } from "@/components/app/AshDock";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useFolders } from "@/hooks/useFolders";
import { useReminderNotifier } from "@/hooks/useReminderNotifier";
import { useCreateIdea } from "@/hooks/useIdeas";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { IdeaFilter } from "@/hooks/useIdeas";



type View = "ideas" | "folders" | "calendar" | "graph";

const Shell = () => {
  const [view, setView] = useState<View>("ideas");
  // The Capture page is filter "all". Switching to any other filter (recent, folder, favorites, search)
  // takes the user to the Browse list. Folders page is its own top-level view.
  const [filter, setFilter] = useState<IdeaFilter>({ kind: "all" });
  // Remembers the last non-search filter so clearing the search bar returns
  // the user to where they were (e.g., the folder they were browsing).
  const [preSearchFilter, setPreSearchFilter] = useState<IdeaFilter>({ kind: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [capture, setCapture] = useState<
    | { kind: "url"; url: string }
    | null
  >(null);
  const isMobile = useIsMobile();

  // Stop any speech when leaving the capture view or unmounting.
  useEffect(() => {
    return () => {
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    };
  }, []);

  // Deep-link: ?idea=<id> opens that idea directly (used by Collab share links).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ideaParam = params.get("idea");
    if (ideaParam) {
      setSelectedId(ideaParam);
      if (params.get("collab") === "1") {
        toast.success("Brainstorm mode", { description: "You're viewing a shared idea." });
      }
    }
  }, []);

  const { user, signOut } = useAuth();
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();

  // Polls folders client-side; fires browser + toast notifications when due.
  useReminderNotifier();

  // Quick-add a stub idea in the current scope, then open it for editing.
  const handleQuickAdd = async () => {
    const folderId = filter.kind === "folder" ? filter.folderId : null;
    const folderName = folderId ? folders.find((f) => f.id === folderId)?.name ?? "Idea" : "Idea";
    try {
      const created = await createIdea.mutateAsync({
        title: `New ${folderName} entry`,
        raw_note: "",
        source_type: "manual",
        folder_id: folderId,
      });
      const id = (created as { id?: string } | null)?.id;
      if (id) setSelectedId(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create idea");
    }
  };

  const backLabel = (() => {
    switch (filter.kind) {
      case "all":
        return "All ideas";
      case "favorites":
        return "Favorites";
      case "recent":
        return "Recent";
      case "search":
        return "Search";
      case "folder": {
        const f = folders.find((x) => x.id === filter.folderId);
        return f?.name ?? "Folder";
      }
    }
  })();

  const onSearch = (v: string) => {
    setSearchValue(v);
    if (v.trim()) {
      setView("ideas");
      // Remember where we were so clearing the search restores that scope.
      setFilter((current) => {
        if (current.kind !== "search") setPreSearchFilter(current);
        const base = current.kind === "search" ? preSearchFilter : current;
        if (base.kind === "folder") {
          return { kind: "search", query: v, folderId: base.folderId } as IdeaFilter;
        }
        return { kind: "search", query: v };
      });
    } else {
      setFilter(preSearchFilter);
    }
  };

  const clearSearch = () => {
    setSearchValue("");
    setFilter(preSearchFilter);
  };

  const handleFilterChange = (f: IdeaFilter) => {
    setView("ideas");
    setFilter(f);
    if (f.kind !== "search") {
      setSearchValue("");
      setPreSearchFilter(f);
    }
  };

  const openFoldersPage = () => {
    setView("folders");
    setSelectedId(null);
  };

  const openCalendarPage = () => {
    setView("calendar");
    setSelectedId(null);
  };

  const openGraphPage = () => {
    setView("graph");
    setSelectedId(null);
  };

  // On the graph view we render the idea detail as an overlay *inside* the graph
  // (so the graph stays mounted underneath). Everywhere else, mobile flips into
  // a full-screen detail view when an idea is selected.
  const showDetailOnly = isMobile && selectedId !== null && view !== "graph";
  const showFolders = view === "folders" && !showDetailOnly;
  const showCalendar = view === "calendar" && !showDetailOnly;
  const showGraph = view === "graph";
  const defaultFolderId = filter.kind === "folder" ? filter.folderId : null;

  const activeFolderName =
    filter.kind === "folder"
      ? (folders.find((f) => f.id === filter.folderId)?.name ?? "Folder")
      : null;

  // Desktop top-bar nav items. Icons are Material Symbols Rounded names
  // (https://fonts.google.com/icons) — Gemini 2026 visual language.
  const navItems: Array<{
    label: string;
    icon: string;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      label: "Capture",
      icon: "auto_awesome",
      active: view === "ideas" && filter.kind === "all",
      onClick: () => handleFilterChange({ kind: "all" }),
    },
    {
      label: "Calendar",

      icon: "calendar_month",
      active: view === "calendar",
      onClick: openCalendarPage,
    },
    {
      label: activeFolderName ?? "Folders",
      icon: "folder",
      active: view === "folders" || filter.kind === "folder",
      onClick: openFoldersPage,
    },
    {
      label: "Graph",
      icon: "hub",
      active: view === "graph",
      onClick: openGraphPage,
    },
    {
      label: "Favorites",
      icon: "star",
      active: view === "ideas" && filter.kind === "favorites",
      onClick: () => handleFilterChange({ kind: "favorites" }),
    },
  ];


  return (
    <div className="flex flex-col h-[100dvh] w-full bg-transparent overflow-hidden relative">


      {/* Top bar — search + (desktop) inline nav. Hidden on mobile when viewing detail or the folders page (folders has its own header). */}
      {!showDetailOnly && !(isMobile && showFolders) && !(isMobile && showCalendar) && !(isMobile && showGraph) && (
        <header className={cn(
          "sticky top-0 z-20 bg-transparent backdrop-blur-xl",
          filter.kind !== "all" && "safe-top"
        )}>

          <div aria-hidden className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="px-3 sm:px-5 lg:px-8 py-1.5 lg:py-2.5 flex items-center gap-2 sm:gap-3 lg:gap-4">

            {/* Brand — desktop only */}
            <div className="hidden [html.desktop-expanded_&]:flex items-center gap-2.5 shrink-0 pr-2 lg:pr-4">
              <div className="relative h-9 w-9 rounded-xl brand-gradient ring-glow flex items-center justify-center">
                <span className="font-display text-[15px] font-bold text-white drop-shadow">IV</span>
                <span aria-hidden className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
              </div>
              <span className="font-display text-[17px] font-semibold tracking-tight">
                Idea<span className="brand-gradient-text">Vault</span>
              </span>
            </div>


            {/* Search — hidden on the Capture page; available everywhere else */}
            {!(view === "ideas" && filter.kind === "all") && (
              <div className="relative flex-1 max-w-xl">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(e) => onSearch(e.target.value)}
                  placeholder="Search saved ideas…"
                  className="pl-9 pr-9 h-9 rounded-[10px] bg-white/[0.04] border-transparent focus-visible:bg-white/[0.06] text-[15px]"
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
            )}


            {/* Desktop nav — Gemini 2026 fluid pills */}
            <nav className="hidden [html.desktop-expanded_&]:flex items-center gap-1.5 ml-auto">
              {navItems.map(({ label, icon, active, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  data-active={active}
                  className="fluid-pill"
                >
                  <MaterialIcon name={icon} filled={active} size={20} />
                  {label}
                </button>
              ))}
              <div className="w-px h-5 mx-2 bg-border/60" aria-hidden />
              <button
                onClick={() => setSettingsOpen(true)}
                className="fluid-icon-btn"
                aria-label="Settings"
                title={user?.email ?? "Settings"}
              >
                <MaterialIcon name="tune" size={20} />
              </button>
              <button
                onClick={signOut}
                className="fluid-icon-btn"
                aria-label="Sign out"
              >
                <MaterialIcon name="logout" size={20} />
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
            onOpenRecent={() => {
              setView("ideas");
              handleFilterChange({ kind: "recent" });
            }}
            onBack={isMobile ? () => {
              setView("ideas");
            } : undefined}
          />
        )}


        {/* Calendar page — full-width when active */}
        {showCalendar && (
          <CalendarPage onBack={isMobile ? () => setView("ideas") : undefined} />
        )}

        {/* Graph page — Obsidian-style brain map. Tapping a node opens the
            idea detail as an overlay so the graph stays mounted underneath
            and "Back" returns to the exact same view. */}
        {showGraph && (
          <div className="relative flex-1 min-h-0 flex">
            <GraphPage
              onOpenIdea={(id) => setSelectedId(id)}
              onBack={() => setView("ideas")}
            />
            {selectedId && (
              <div
                className="absolute inset-0 z-30 glass-card-strong rounded-none"
                style={{ paddingBottom: "var(--mobile-tabbar-h, 0px)" }}
              >
                <IdeaDetail
                  ideaId={selectedId}
                  onClose={() => setSelectedId(null)}
                  backLabel="Back to Graph"
                  onSelectIdea={setSelectedId}
                />
              </div>
            )}
          </div>
        )}


        {/* Capture view — compose only, full width. Shown when filter is "all" (the default landing). */}
        {!showFolders && !showCalendar && !showGraph && !showDetailOnly && filter.kind === "all" && (
          <div
            className="w-full flex-1 min-w-0 flex flex-col min-h-0 bg-transparent overflow-y-auto scroll-momentum touch-pan-y"
            style={{ paddingBottom: "calc(var(--ash-dock-h, 0px) + env(safe-area-inset-bottom) + (var(--mobile-tabbar-h, 0px)) + 1.25rem)" }}
          >

            <div className="w-full px-3 sm:px-6 lg:px-10 pt-6 sm:pt-10 pb-4 flex-1 min-h-0 flex flex-col items-center gap-5 sm:gap-6 max-w-3xl mx-auto">

              

              <VoiceOrb />
            </div>






          </div>
        )}

        {/* Browse view — flat list of ideas (Recents, Favorites, Folder-filtered, Search). */}
        {!showFolders && !showCalendar && !showGraph && !showDetailOnly && filter.kind !== "all" && (
          <div
            className="w-full flex-1 min-w-0 md:w-[28rem] md:flex-none md:shrink-0 md:border-r border-border flex flex-col min-h-0 bg-transparent md:overflow-hidden overflow-y-auto scroll-momentum touch-pan-y"
            style={{ paddingBottom: isMobile ? "calc(var(--ash-dock-h, 0px) + var(--mobile-tabbar-h, 0px) + env(safe-area-inset-bottom) + 1rem)" : "1.5rem" }}
          >

            <div className="md:flex-1 md:min-h-0 md:overflow-hidden">
              <IdeaList
                filter={filter}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onBackToFolders={openFoldersPage}
                onFilterChange={handleFilterChange}
                pageScroll={isMobile}
              />
            </div>
          </div>
        )}

        {/* Detail — desktop always shows, mobile only when an idea is selected */}
        {!showFolders && !showCalendar && !showGraph && (!isMobile || showDetailOnly) && (
          <IdeaDetail ideaId={selectedId} onClose={() => setSelectedId(null)} backLabel={backLabel} onSelectIdea={setSelectedId} />
        )}
      </div>

      {/* Floating "+ Add" — visible in any browse scope (folder, recent, favorites, search).
          Creates a stub idea in the active folder (or default) and opens it for editing. */}
      {!showFolders && !showCalendar && !showGraph && !showDetailOnly && filter.kind !== "all" && (
        <button
          onClick={handleQuickAdd}
          disabled={createIdea.isPending}
          aria-label="Add idea here"
          className="fixed z-30 right-4 h-14 w-14 rounded-full brand-gradient ring-glow flex items-center justify-center text-white shadow-xl hover:scale-105 active:scale-95 transition disabled:opacity-60"
          style={{ bottom: "calc(var(--ash-dock-h, 0px) + var(--mobile-tabbar-h, 0px) + env(safe-area-inset-bottom) + 1rem)" }}
        >
          <Plus className="h-6 w-6" strokeWidth={2.4} />
        </button>
      )}

      {/* Mobile bottom tab bar (iOS-style) */}
      {isMobile && (
        <MobileTabBar
          filter={filter}
          view={view === "folders" ? "folders" : view === "calendar" ? "calendar" : view === "graph" ? "graph" : "ideas"}
          onFilterChange={handleFilterChange}
          onOpenFolders={openFoldersPage}
          onOpenCalendar={openCalendarPage}
          onOpenGraph={openGraphPage}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {!showDetailOnly && view === "ideas" && filter.kind === "all" && <AshDock />}

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AlarmOverlay />

      {capture?.kind === "url" && (
        <UrlCaptureScreen
          defaultUrl={capture.url}
          defaultFolderId={defaultFolderId}
          onBack={() => setCapture(null)}
          onCreated={(id) => {
            setCapture(null);
            setSelectedId(id);
          }}
        />
      )}
    </div>

  );
};

const Index = () => (
  <ProtectedRoute>
    <Shell />
  </ProtectedRoute>
);

export default Index;
