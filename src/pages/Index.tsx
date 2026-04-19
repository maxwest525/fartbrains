import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AppSidebar } from "@/components/app/AppSidebar";
import { IdeaList } from "@/components/app/IdeaList";
import { IdeaDetail } from "@/components/app/IdeaDetail";
import { NewIdeaDialog } from "@/components/app/NewIdeaDialog";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { IdeaFilter } from "@/hooks/useIdeas";

const Shell = () => {
  const [filter, setFilter] = useState<IdeaFilter>({ kind: "all" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const onSearch = (v: string) => {
    setSearchValue(v);
    if (v.trim()) setFilter({ kind: "search", query: v });
    else setFilter({ kind: "all" });
  };

  const clearSearch = () => {
    setSearchValue("");
    setFilter({ kind: "all" });
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar
        filter={filter}
        onFilterChange={(f) => {
          setFilter(f);
          if (f.kind !== "search") setSearchValue("");
        }}
        onNewIdea={() => setNewOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-border px-5 py-2.5 bg-background flex items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search ideas…"
              className="pl-9 pr-9"
            />
            {searchValue && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <IdeaList filter={filter} selectedId={selectedId} onSelect={setSelectedId} />
          <IdeaDetail ideaId={selectedId} onClose={() => setSelectedId(null)} />
        </div>
      </div>

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
