import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Inbox } from "lucide-react";
import { useDuplicateUrl } from "@/hooks/useDuplicateUrl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFolders } from "@/hooks/useFolders";
import { useCreateIdea, useUpdateIdea } from "@/hooks/useIdeas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SourcePicker, isSourceEnabled, type SourceKey } from "./SourcePicker";

const NO_FOLDER = "__none__";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultFolderId?: string | null;
  onCreated?: (id: string) => void;
  /** Opens an already-existing idea (used when a duplicate URL is detected). */
  onOpenExisting?: (id: string) => void;
};

const PLACEHOLDERS: Record<SourceKey, { url?: string; note: string }> = {
  instagram: { url: "Instagram Reel URL *", note: "Quick note (optional)" },
  link:      { url: "URL *",                note: "Quick note (optional)" },
  note:      {                              note: "Write your idea…" },
  voice:     { note: "" },
  image:     { note: "" },
  prompt:    { note: "" },
};

/**
 * iOS-style "compose" dialog. Pick a source, fill a tiny form, hit Save.
 * For Instagram/Link, extraction + AI summary run in the background after save
 * so the user lands back on the list immediately (no preview step).
 */
export const NewIdeaDialog = ({ open, onOpenChange, defaultFolderId, onCreated, onOpenExisting }: Props) => {
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();
  const updateIdea = useUpdateIdea();

  const [source, setSource] = useState<SourceKey>("instagram");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<string>(defaultFolderId ?? NO_FOLDER);
  const [saving, setSaving] = useState(false);

  const { data: urlDuplicate } = useDuplicateUrl(source === "instagram" || source === "link" ? url : "");

  const reset = () => {
    setSource("instagram");
    setUrl("");
    setNote("");
    setTitle("");
    setFolder(defaultFolderId ?? NO_FOLDER);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const folderOrNull = (v: string) => (v === NO_FOLDER ? null : v);
  const needsUrl = source === "instagram" || source === "link";

  const handleSourceChange = (key: SourceKey) => {
    if (!isSourceEnabled(key)) {
      toast("Coming soon", { description: `${key.charAt(0).toUpperCase() + key.slice(1)} captures are on the roadmap.` });
      return;
    }
    setSource(key);
  };

  /** Background enrichment for URL-based ideas — extract + summarize then patch the row. */
  const enrichInBackground = async (ideaId: string, srcUrl: string) => {
    try {
      const { data: ext, error: extErr } = await supabase.functions.invoke("extract-url", {
        body: { url: srcUrl },
      });
      if (extErr) throw new Error(extErr.message);
      if (ext?.error) throw new Error(ext.error);

      const extractedText: string = ext.text ?? "";
      const suggestedTitle: string | undefined = ext.title;

      // Summarize (best-effort)
      let summary: string | null = null;
      let aiTitle: string | undefined;
      try {
        const { data: sum, error: sumErr } = await supabase.functions.invoke("summarize", {
          body: { text: extractedText, kind: "webpage" },
        });
        if (!sumErr && !sum?.error) {
          summary = sum.summary ?? null;
          aiTitle = sum.suggestedTitle;
        }
      } catch {/* ignore — extraction still useful */}

      await updateIdea.mutateAsync({
        id: ideaId,
        patch: {
          extracted_text: extractedText || null,
          ai_summary: summary,
          // Only fill title if user left it blank
          ...(title.trim() ? {} : { title: (aiTitle || suggestedTitle || srcUrl).slice(0, 200) }),
        },
      });
    } catch (e) {
      // Non-fatal — the idea is already saved with whatever the user typed.
      toast.error(e instanceof Error ? `Auto-extract failed: ${e.message}` : "Auto-extract failed");
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (needsUrl && !url.trim()) return toast.error("URL required");
    if (source === "note" && !note.trim() && !title.trim()) return toast.error("Add a title or a note");

    setSaving(true);
    try {
      const fallbackTitle =
        title.trim() ||
        (needsUrl ? url.trim() : note.trim().split("\n")[0].slice(0, 80)) ||
        "Untitled idea";

      const idea = await createIdea.mutateAsync({
        title: fallbackTitle,
        raw_note: note.trim() || null,
        source_url: needsUrl ? url.trim() : null,
        source_type: needsUrl ? "webpage" : "manual",
        folder_id: folderOrNull(folder),
        tags: [],
      });

      onCreated?.(idea.id);
      close();

      // Fire-and-forget enrichment for URL ideas — runs after the dialog closes.
      if (needsUrl) {
        void enrichInBackground(idea.id, url.trim());
      }
    } finally {
      setSaving(false);
    }
  };

  const ph = PLACEHOLDERS[source];

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-lg w-full sm:max-h-[90vh] max-h-[100dvh] h-[100dvh] sm:h-auto sm:rounded-2xl rounded-none overflow-y-auto p-4 sm:p-6 bg-card">
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl">New Idea</DialogTitle>
          <DialogDescription className="sr-only">
            Pick a source, fill in the details, and save. Links are summarized in the background.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <SourcePicker value={source} onChange={handleSourceChange} />

          {needsUrl && (
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={ph.url}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
            />
          )}

          {urlDuplicate && needsUrl && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground">You already saved this link</div>
                <div className="text-muted-foreground truncate">"{urlDuplicate.title}"</div>
              </div>
              {onOpenExisting && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenExisting(urlDuplicate.id);
                    close();
                  }}
                >
                  Open
                </Button>
              )}
            </div>
          )}

          {source === "note" ? (
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={ph.note}
              rows={6}
              className="rounded-xl bg-secondary/60 border-transparent text-[15px] resize-none"
            />
          ) : (
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={ph.note}
              className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
            />
          )}

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional — AI will fill in)"
            className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
          />

          <Select value={folder} onValueChange={setFolder}>
            <SelectTrigger className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]">
              <div className="flex items-center gap-2">
                <Inbox className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FOLDER}>No folder</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleSave}
            disabled={saving || createIdea.isPending}
            className="w-full h-12 rounded-xl text-[16px] font-semibold mt-1"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Save idea
              </>
            )}
          </Button>

          {needsUrl && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              We'll grab the page text and write a summary for you in the background.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
