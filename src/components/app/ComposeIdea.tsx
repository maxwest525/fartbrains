import { useEffect, useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Inbox, Folder as FolderIcon, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDuplicateUrl } from "@/hooks/useDuplicateUrl";
import { useUrlCheck } from "@/hooks/useUrlCheck";
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
  defaultFolderId?: string | null;
  onCreated?: (id: string) => void;
  onOpenExisting?: (id: string) => void;
};

const PLACEHOLDERS: Record<SourceKey, { url?: string; note: string }> = {
  instagram: { url: "Instagram Reel URL", note: "Quick note (optional)" },
  link:      { url: "Paste a URL",        note: "Quick note (optional)" },
  note:      {                            note: "Write your idea…" },
  list:      {                            note: "One item per line…\nBuy milk\nCall dentist\nShip v2" },
  voice:     { note: "" },
  image:     { note: "" },
  prompt:    { note: "" },
};

/** Convert raw textarea lines into a markdown checklist. Blank lines are skipped. */
const linesToChecklist = (raw: string): string =>
  raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/^- \[[ xX]\] /.test(l) ? l : `- [ ] ${l}`))
    .join("\n");

/**
 * Always-visible compose card. Lives on the main page above the idea list
 * so capture is one tap away — no modal required.
 */
export const ComposeIdea = ({ defaultFolderId, onCreated, onOpenExisting }: Props) => {
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();
  const updateIdea = useUpdateIdea();

  const [source, setSource] = useState<SourceKey>("instagram");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<string>(defaultFolderId ?? NO_FOLDER);
  const [saving, setSaving] = useState(false);

  // Keep folder selection in sync when the parent switches active folder filter.
  useEffect(() => {
    setFolder(defaultFolderId ?? NO_FOLDER);
  }, [defaultFolderId]);

  const { data: urlDuplicate } = useDuplicateUrl(
    source === "instagram" || source === "link" ? url : ""
  );

  // Live reachability check on the URL field — debounced server call.
  const urlCheck = useUrlCheck(url, source === "instagram" || source === "link");

  const reset = () => {
    setUrl("");
    setNote("");
    setTitle("");
  };

  const folderOrNull = (v: string) => (v === NO_FOLDER ? null : v);
  const needsUrl = source === "instagram" || source === "link";

  const handleSourceChange = (key: SourceKey) => {
    if (!isSourceEnabled(key)) {
      toast("Coming soon", {
        description: `${key.charAt(0).toUpperCase() + key.slice(1)} captures are on the roadmap.`,
      });
      return;
    }
    setSource(key);
  };

  /** Background enrichment for URL ideas — extract + summarize, then patch row. */
  const enrichInBackground = async (ideaId: string, srcUrl: string, hadUserTitle: boolean) => {
    try {
      const { data: ext, error: extErr } = await supabase.functions.invoke("extract-url", {
        body: { url: srcUrl },
      });
      if (extErr) throw new Error(extErr.message);
      if (ext?.error) throw new Error(ext.error);

      const extractedText: string = ext.text ?? "";
      const suggestedTitle: string | undefined = ext.title;

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
      } catch {/* non-fatal */}

      await updateIdea.mutateAsync({
        id: ideaId,
        patch: {
          extracted_text: extractedText || null,
          ai_summary: summary,
          ...(hadUserTitle ? {} : { title: (aiTitle || suggestedTitle || srcUrl).slice(0, 200) }),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? `Auto-extract failed: ${e.message}` : "Auto-extract failed");
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (needsUrl && !url.trim()) return toast.error("URL required");
    if (source === "note" && !note.trim() && !title.trim())
      return toast.error("Add a title or a note");
    if (source === "list" && !note.trim() && !title.trim())
      return toast.error("Add at least one list item or a title");

    setSaving(true);
    try {
      const userTitle = title.trim();
      const isList = source === "list";
      const listBody = isList ? linesToChecklist(note) : null;

      const fallbackTitle =
        userTitle ||
        (needsUrl
          ? url.trim()
          : isList
            ? (note.trim().split("\n").find((l) => l.trim()) ?? "").slice(0, 80) || "Checklist"
            : note.trim().split("\n")[0].slice(0, 80)) ||
        "Untitled idea";

      const idea = await createIdea.mutateAsync({
        title: fallbackTitle,
        raw_note: isList ? listBody : (note.trim() || null),
        source_url: needsUrl ? url.trim() : null,
        source_type: needsUrl ? "webpage" : "manual",
        folder_id: folderOrNull(folder),
        tags: isList ? ["list"] : [],
      });

      onCreated?.(idea.id);
      reset();

      if (needsUrl) {
        void enrichInBackground(idea.id, url.trim(), !!userTitle);
      }
    } finally {
      setSaving(false);
    }
  };

  const ph = PLACEHOLDERS[source];

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-3 sm:p-4 space-y-3 shadow-sm">
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

      {/* Live URL reachability — only shown when the user has typed something */}
      {needsUrl && url.trim() && urlCheck.status !== "idle" && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
            urlCheck.status === "checking" && "bg-secondary/60 text-muted-foreground",
            urlCheck.status === "ok" && "bg-[hsl(140_70%_45%/0.1)] text-[hsl(140_70%_30%)] dark:text-[hsl(140_60%_60%)]",
            urlCheck.status === "error" && "bg-destructive/10 text-destructive"
          )}
          role="status"
          aria-live="polite"
        >
          {urlCheck.status === "checking" && (
            <Loader2 className="h-3.5 w-3.5 mt-0.5 shrink-0 animate-spin" />
          )}
          {urlCheck.status === "ok" && (
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          )}
          {urlCheck.status === "error" && (
            <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium leading-tight">{urlCheck.message}</div>
            {urlCheck.status === "ok" && urlCheck.redirected && urlCheck.finalUrl && (
              <div className="mt-0.5 flex items-center gap-1 text-[11.5px] opacity-80 truncate">
                <ArrowRight className="h-3 w-3 shrink-0" />
                <span className="truncate">{urlCheck.finalUrl}</span>
              </div>
            )}
          </div>
        </div>
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
                reset();
              }}
            >
              Open
            </Button>
          )}
        </div>
      )}

      {source === "note" || source === "list" ? (
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={ph.note}
          rows={source === "list" ? 5 : 4}
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
          <SelectItem value={NO_FOLDER}>All ideas</SelectItem>
          {folders.map((f) => (
            <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quick folder chips — tap to set folder above without opening the dropdown. */}
      {folders.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5 scrollbar-none">
          <button
            type="button"
            onClick={() => setFolder(NO_FOLDER)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-full text-[13px] font-medium border transition-colors press",
              folder === NO_FOLDER
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/60 text-muted-foreground border-transparent hover:text-foreground"
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
                    : "bg-secondary/60 text-muted-foreground border-transparent hover:text-foreground"
                )}
                title={f.name}
              >
                <FolderIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
            );
          })}
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={saving || createIdea.isPending}
        className="w-full h-12 rounded-xl text-[16px] font-semibold"
      >
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-1.5" />
            {needsUrl ? "Extract & save" : source === "list" ? "Save list" : "Save idea"}
          </>
        )}
      </Button>

      {needsUrl && (
        <p className="text-xs text-muted-foreground text-center">
          We'll grab the page text and write a summary in the background.
        </p>
      )}
    </div>
  );
};
