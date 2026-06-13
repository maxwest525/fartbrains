import { useEffect, useRef, useState } from "react";
import { Search, X, Inbox, Folder, Star, Clock, CalendarDays, Settings as SettingsIcon, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { IdeaList } from "@/components/app/IdeaList";
import { IdeaDetail } from "@/components/app/IdeaDetail";
import { AshChatPanel, type AshChatHandle } from "@/components/app/home/AshChatPanel";
import { VoiceOrb } from "@/components/app/VoiceOrb";
import { UrlCaptureScreen } from "@/components/app/UrlCaptureScreen";
import { TranscriptCaptureScreen } from "@/components/app/TranscriptCaptureScreen";

import { MobileTabBar } from "@/components/app/MobileTabBar";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { FoldersPage } from "@/components/app/FoldersPage";
import { CalendarPage } from "@/components/app/CalendarPage";
import { AlarmOverlay } from "@/components/app/AlarmOverlay";
import { AshDock } from "@/components/app/AshDock";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useFolders } from "@/hooks/useFolders";
import { useReminderNotifier } from "@/hooks/useReminderNotifier";
import { useAshChat } from "@/hooks/useAshChat";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { IdeaFilter } from "@/hooks/useIdeas";



type View = "ideas" | "folders" | "calendar";

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
    | { kind: "transcript"; text: string }
    | null
  >(null);
  const isMobile = useIsMobile();
  const [liveMode, setLiveMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const chatRef = useRef<AshChatHandle>(null);
  const composeRef = useRef<HTMLDivElement>(null);

  // Live chat: stream replies via useAshChat and speak the assistant's reply.
  const liveChat = useAshChat();
  const liveSpokenIdxRef = useRef<number>(-1);
  const wasStreamingRef = useRef(false);

  // When a streamed reply finishes, speak it.
  useEffect(() => {
    if (!liveMode) return;
    const justFinished = wasStreamingRef.current && !liveChat.streaming;
    wasStreamingRef.current = liveChat.streaming;
    if (!justFinished) return;
    const lastIdx = liveChat.messages.length - 1;
    const last = liveChat.messages[lastIdx];
    if (!last || last.role !== "assistant" || !last.content.trim()) return;
    if (liveSpokenIdxRef.current === lastIdx) return;
    liveSpokenIdxRef.current = lastIdx;
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(last.content);
      utter.rate = 1.0;
      utter.pitch = 1.0;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      synth.speak(utter);
    } catch { /* ignore */ }
  }, [liveChat.messages, liveChat.streaming, liveMode]);

  // Surface chat errors.
  useEffect(() => {
    if (liveChat.error) toast.error(liveChat.error);
  }, [liveChat.error]);

  // Stop any speech when leaving the capture view or unmounting.
  useEffect(() => {
    return () => {
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    };
  }, []);

  const { user, signOut } = useAuth();
  const { data: folders = [] } = useFolders();

  // Polls folders client-side; fires browser + toast notifications when due.
  useReminderNotifier();

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

  const showDetailOnly = isMobile && selectedId !== null;
  const showFolders = view === "folders" && !showDetailOnly;
  const showCalendar = view === "calendar" && !showDetailOnly;
  const defaultFolderId = filter.kind === "folder" ? filter.folderId : null;

  const activeFolderName =
    filter.kind === "folder"
      ? (folders.find((f) => f.id === filter.folderId)?.name ?? "Folder")
      : null;

  // Desktop top-bar nav items.
  const navItems: Array<{
    label: string;
    icon: typeof Inbox;
    active: boolean;
    onClick: () => void;
  }> = [
    {
      label: "Capture",
      icon: Inbox,
      active: view === "ideas" && filter.kind === "all",
      onClick: () => handleFilterChange({ kind: "all" }),
    },

    {
      label: "Recents",
      icon: Clock,
      active: view === "ideas" && filter.kind === "recent",
      onClick: () => handleFilterChange({ kind: "recent" }),
    },
    {
      label: "Calendar",
      icon: CalendarDays,
      active: view === "calendar",
      onClick: openCalendarPage,
    },
    {
      label: activeFolderName ?? "Folders",
      icon: Folder,
      active: view === "folders" || filter.kind === "folder",
      onClick: openFoldersPage,
    },
    {
      label: "Favorites",
      icon: Star,
      active: view === "ideas" && filter.kind === "favorites",
      onClick: () => handleFilterChange({ kind: "favorites" }),
    },
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden relative">


      {/* Top bar — search + (desktop) inline nav. Hidden on mobile when viewing detail or the folders page (folders has its own header). */}
      {!showDetailOnly && !(isMobile && showFolders) && !(isMobile && showCalendar) && (
        <header className={cn(
          "sticky top-0 z-20 bg-background/70 backdrop-blur-xl border-b border-border/60",
          filter.kind !== "all" && "safe-top"
        )}>
          <div aria-hidden className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
          <div className="px-3 sm:px-5 py-2 flex items-center gap-2 sm:gap-3">
            {/* Brand — desktop only */}
            <div className="hidden md:flex items-center gap-2.5 shrink-0 pr-2">
              <div className="relative h-9 w-9 rounded-xl brand-gradient ring-glow flex items-center justify-center">
                <span className="font-display text-[15px] font-bold text-white drop-shadow">IV</span>
                <span aria-hidden className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
              </div>
              <span className="font-display text-[17px] font-semibold tracking-tight">
                Idea<span className="brand-gradient-text">Vault</span>
              </span>
            </div>

            {/* Search — hidden on the Capture view (it appears below the ticker there) */}
            {filter.kind !== "all" && (
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
            )}
            {filter.kind === "all" && <div className="flex-1" />}

            {/* Desktop nav — replaces the old sidebar */}
            <nav className="hidden md:flex items-center gap-1 ml-auto">
              {navItems.map(({ label, icon: Icon, active, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium transition-all",
                    active
                      ? "text-white brand-gradient shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.65)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
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
            onBack={isMobile ? () => {
              setView("ideas");
            } : undefined}
          />
        )}

        {/* Calendar page — full-width when active */}
        {showCalendar && (
          <CalendarPage onBack={isMobile ? () => setView("ideas") : undefined} />
        )}




        {/* Capture view — compose only, full width. Shown when filter is "all" (the default landing). */}
        {!showFolders && !showCalendar && !showDetailOnly && filter.kind === "all" && (
          <div
            className="w-full flex-1 min-w-0 flex flex-col min-h-0 bg-background overflow-y-auto scroll-momentum touch-pan-y"
            style={{ paddingBottom: "calc(var(--ash-dock-h, 0px) + env(safe-area-inset-bottom) + 1.25rem)" }}
          >

            <div className="w-full px-3 sm:px-6 lg:px-10 pt-3 sm:pt-4">
              <div className="relative max-w-xl mx-auto">
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
            <div ref={composeRef} className="w-full px-3 sm:px-6 lg:px-10 pt-3 sm:pt-6 pb-4 flex-1 min-h-0 flex flex-col items-center justify-center gap-4 sm:gap-6 max-w-3xl mx-auto">
              <VoiceOrb
                liveMode={liveMode}
                onToggleLive={(next) => {
                  setLiveMode(next);
                  if (!next) {
                    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
                    setSpeaking(false);
                  }
                }}
                speaking={speaking}
                onLiveTranscript={(text) => {
                  void liveChat.send(text);
                }}

              />
              <p className="text-center text-[12px] text-muted-foreground">
                Captures land in <button onClick={() => handleFilterChange({ kind: "recent" })} className="underline underline-offset-2 hover:text-foreground">Recents</button> and the All folder.
              </p>
            </div>



          </div>
        )}

        {/* Browse view — flat list of ideas (Recents, Favorites, Folder-filtered, Search). */}
        {!showFolders && !showCalendar && !showDetailOnly && filter.kind !== "all" && (
          <div
            className="w-full flex-1 min-w-0 md:w-[28rem] md:flex-none md:shrink-0 md:border-r border-border flex flex-col min-h-0 bg-background md:overflow-hidden overflow-y-auto scroll-momentum touch-pan-y"
            style={{ paddingBottom: "calc(var(--ash-dock-h, 0px) + 5.75rem + env(safe-area-inset-bottom))" }}
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
        {!showFolders && !showCalendar && (!isMobile || showDetailOnly) && (
          <IdeaDetail ideaId={selectedId} onClose={() => setSelectedId(null)} backLabel={backLabel} onSelectIdea={setSelectedId} />
        )}
      </div>

      {/* Mobile bottom tab bar (iOS-style) */}
      {isMobile && !showDetailOnly && (
        <MobileTabBar
          filter={filter}
          view={view === "folders" ? "folders" : view === "calendar" ? "calendar" : "ideas"}
          onFilterChange={handleFilterChange}
          onOpenFolders={openFoldersPage}
          onOpenCalendar={openCalendarPage}
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
      {capture?.kind === "transcript" && (
        <TranscriptCaptureScreen
          defaultFolderId={defaultFolderId}
          defaultText={capture.text}
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
