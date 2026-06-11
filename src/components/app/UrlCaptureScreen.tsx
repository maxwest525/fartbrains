import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, Sparkles, Inbox, Folder as FolderIcon, Plus, Link as LinkIcon, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFolders, useCreateFolder } from "@/hooks/useFolders";
import { useCreateIdea } from "@/hooks/useIdeas";
import { useDuplicateUrl } from "@/hooks/useDuplicateUrl";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const NO_FOLDER = "__none__";

type Props = {
  defaultUrl?: string;
  defaultFolderId?: string | null;
  onBack: () => void;
  onCreated?: (id: string, needsReview?: boolean) => void;
};

/**
 * Full-screen URL capture: paste a URL, we extract the readable text via the
 * extract-url edge function, run summarize, and save raw + summary into the
 * chosen folder. Mirrors TranscriptCaptureScreen's UX.
 */
export const UrlCaptureScreen = ({ defaultUrl, defaultFolderId, onBack, onCreated }: Props) => {
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();
  const createFolder = useCreateFolder();

  const [url, setUrl] = useState(defaultUrl ?? "");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<string>(defaultFolderId ?? NO_FOLDER);
  const [busy, setBusy] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const dup = useDuplicateUrl(url);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => urlRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const folderOrNull = (v: string) => (v === NO_FOLDER ? null : v);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const created = await createFolder.mutateAsync(name);
      setFolder(created.id);
      setNewFolderName("");
      setNewFolderOpen(false);
    } catch {
      /* toast handled in hook */
    }
  };

  const validUrl = (() => {
    try {
      const u = new URL(url.trim().includes("://") ? url.trim() : `https://${url.trim()}`);
      return ["http:", "https:"].includes(u.protocol) ? u.toString() : null;
    } catch {
      return null;
    }
  })();

  const handleSave = async ({ summarize }: { summarize: boolean }) => {
    if (busy) return;
    if (!validUrl) return toast.error("Enter a valid URL");
    setBusy(true);
    try {
      let extracted = "";
      let pageTitle: string | null = null;
      let siteName: string | null = null;

      try {
        const { data: ex, error: exErr } = await supabase.functions.invoke("extract-url", {
          body: { url: validUrl },
        });
        if (exErr) throw new Error(exErr.message);
        if (ex?.error) throw new Error(ex.error);
        extracted = (ex?.text as string) ?? "";
        pageTitle = (ex?.title as string) ?? null;
        siteName = (ex?.siteName as string) ?? null;
      } catch (e) {
        toast.warning(e instanceof Error ? e.message : "Couldn't extract page content");
      }

      let summary = "";
      let aiTitle: string | undefined;
      if (summarize && extracted.length >= 50) {
        try {
          const { data: sum, error: sumErr } = await supabase.functions.invoke("summarize", {
            body: { text: extracted, kind: "webpage" },
          });
          if (sumErr) throw new Error(sumErr.message);
          if (sum?.error) throw new Error(sum.error);
          summary = sum?.summary ?? "";
          aiTitle = sum?.suggestedTitle ?? undefined;
        } catch (e) {
          toast.warning(e instanceof Error ? `AI summary failed: ${e.message}` : "AI summary failed");
        }
      }

      const finalTitle = (
        title.trim() || aiTitle || pageTitle || validUrl
      ).slice(0, 200);

      const idea = await createIdea.mutateAsync({
        title: finalTitle,
        raw_note: null,
        source_url: validUrl,
        source_type: "webpage",
        source_label: siteName ?? "Web page",
        source_meta: { kind: "webpage", siteName, author: null, thumbnail: null },
        extracted_text: extracted || null,
        ai_summary: summary.trim() || null,
        folder_id: folderOrNull(folder),
        tags: [],
      });

      const summaryClean = summary.trim();
      const needsReview = summarize && (!summaryClean || summaryClean.length < 150);
      if (needsReview) {
        toast.message("Saved — needs a quick review", {
          description: "AI wasn't fully confident, so we opened the idea for you to edit.",
        });
      }
      onCreated?.(idea.id, needsReview);
      onBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col anim-slide-in">
      <div className="safe-top sticky top-0 z-10 bg-background/80 backdrop-blur-xl px-1 sm:px-4 py-1 sm:py-2 border-b border-border flex items-center gap-1 min-h-[44px]">
        <button
          onClick={onBack}
          className="press flex items-center text-primary -ml-1 pl-1 pr-2 h-10 text-[17px]"
          aria-label="Back"
        >
          <ChevronLeft className="h-6 w-6 -mr-0.5 shrink-0" strokeWidth={2.4} />
          <span className="font-normal">Back</span>
        </button>
        <div className="flex-1 text-center text-[15px] font-semibold truncate px-2">
          Capture link
        </div>
        <div className="w-[72px] shrink-0" />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-momentum touch-pan-y px-4 sm:px-6 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] space-y-4 max-w-3xl mx-auto w-full">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            URL
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={urlRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              type="url"
              className="h-12 rounded-xl pl-9 text-[16px]"
            />
          </div>
          {dup.data && (
            <div className="flex items-start gap-2 mt-1 px-1 text-[12.5px] text-amber-500/90">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>Already in your vault: <span className="font-medium">{dup.data.title}</span></span>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            Title (optional)
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="AI will use the page title if blank"
            maxLength={200}
            className="h-12 rounded-xl text-[16px]"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
            Save to
          </label>
          {newFolderOpen && (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateFolder();
                  } else if (e.key === "Escape") {
                    setNewFolderOpen(false);
                    setNewFolderName("");
                  }
                }}
                placeholder="New folder name"
                className="h-11 rounded-xl text-[15px] flex-1"
                maxLength={60}
              />
              <Button
                type="button"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || createFolder.isPending}
                className="h-11 rounded-xl px-4"
              >
                {createFolder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setNewFolderOpen(false);
                  setNewFolderName("");
                }}
                className="h-11 rounded-xl px-3"
              >
                Cancel
              </Button>
            </div>
          )}
          <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 no-scrollbar scroll-momentum">
            <button
              type="button"
              onClick={() => setFolder(NO_FOLDER)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium border transition-colors press",
                folder === NO_FOLDER
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/60 text-muted-foreground border-transparent hover:text-foreground",
              )}
            >
              <Inbox className="h-3.5 w-3.5" />
              All
            </button>
            {folders.map((f) => {
              const active = folder === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFolder(f.id)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium border transition-colors press max-w-[160px]",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/60 text-muted-foreground border-transparent hover:text-foreground",
                  )}
                  title={f.name}
                >
                  <FolderIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setNewFolderOpen(true)}
              className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium border border-dashed border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors press"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 border-t border-border bg-background/90 backdrop-blur-xl px-4 sm:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave({ summarize: false })}
            disabled={busy || !validUrl}
            className="h-12 rounded-xl text-[15px] font-semibold px-4"
          >
            Save only
          </Button>
          <Button
            type="button"
            onClick={() => handleSave({ summarize: true })}
            disabled={busy || !validUrl}
            className="flex-1 h-12 rounded-xl text-[16px] font-semibold"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Extract &amp; summarize
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
