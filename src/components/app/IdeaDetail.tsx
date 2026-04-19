import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Star, Trash2, ExternalLink, Save, X, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIdea, useUpdateIdea, useDeleteIdea } from "@/hooks/useIdeas";
import { useFolders } from "@/hooks/useFolders";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { toast } from "sonner";

const NO_FOLDER = "__none__";

type Props = {
  ideaId: string | null;
  onClose: () => void;
};

export const IdeaDetail = ({ ideaId, onClose }: Props) => {
  const { data: idea, isLoading } = useIdea(ideaId);
  const { data: folders = [] } = useFolders();
  const updateIdea = useUpdateIdea();
  const deleteIdea = useDeleteIdea();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [rawNote, setRawNote] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [folderId, setFolderId] = useState<string>(NO_FOLDER);

  // Swipe-right from the left edge to go back (mobile only, not while editing)
  useSwipeGesture(containerRef, {
    onSwipe: onClose,
    direction: "right",
    edgeSize: 24,
    enabled: isMobile && !editing && !!ideaId,
  });

  useEffect(() => {
    if (idea) {
      setTitle(idea.title);
      setRawNote(idea.raw_note ?? "");
      setSummary(idea.ai_summary ?? "");
      setTags(idea.tags.join(", "));
      setFolderId(idea.folder_id ?? NO_FOLDER);
      setEditing(false);
    }
  }, [idea?.id]);

  if (!ideaId) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select an idea to view it</p>
        </div>
      </div>
    );
  }

  if (isLoading || !idea) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm h-full">
        Loading…
      </div>
    );
  }

  const onSave = async () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    await updateIdea.mutateAsync({
      id: idea.id,
      patch: {
        title: title.trim(),
        raw_note: rawNote || null,
        ai_summary: summary || null,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        folder_id: folderId === NO_FOLDER ? null : folderId,
      },
    });
    setEditing(false);
  };

  const onToggleFavorite = () => {
    updateIdea.mutate({ id: idea.id, patch: { is_favorite: !idea.is_favorite } });
  };

  const onDelete = () => {
    if (confirm("Delete this idea? This cannot be undone.")) {
      deleteIdea.mutate(idea.id, { onSuccess: onClose });
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background md:animate-none anim-slide-in">
      <div className="safe-top sticky top-0 z-10 bg-background/85 backdrop-blur px-3 sm:px-6 py-2 sm:py-3 border-b border-border flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 md:hidden"
          onClick={onClose}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Badge variant="secondary" className="capitalize">
            {idea.source_type}
          </Badge>
          {idea.source_url && (
            <a
              href={idea.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground hidden sm:flex items-center gap-1 truncate"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{idea.source_url}</span>
            </a>
          )}
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onToggleFavorite} aria-label="Toggle favorite">
            <Star
              className={`h-5 w-5 ${idea.is_favorite ? "fill-accent text-accent" : ""}`}
            />
          </Button>
          {editing ? (
            <>
              <Button variant="ghost" size="sm" className="h-11" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" className="h-11" onClick={onSave} disabled={updateIdea.isPending}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" className="h-11" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onDelete} aria-label="Delete">
            <Trash2 className="h-5 w-5 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5">
        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-semibold h-auto py-2"
          />
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">{idea.title}</h1>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Created:</span>{" "}
            {new Date(idea.created_at).toLocaleString()}
          </div>
          <div>
            <span className="font-medium text-foreground">Updated:</span>{" "}
            {new Date(idea.updated_at).toLocaleString()}
          </div>
        </div>

        {editing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Folder</label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FOLDER}>No folder</SelectItem>
                  {folders.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Tags (comma separated)
              </label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}

        {!editing && idea.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {idea.tags.map((t) => (
              <Badge key={t} variant="outline">
                {t}
              </Badge>
            ))}
          </div>
        )}

        {(editing || idea.ai_summary) && (
          <section>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Summary
            </h3>
            {editing ? (
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            ) : (
              <div className="rounded-md bg-muted/40 p-4 text-sm prose prose-sm dark:prose-invert max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-h3:text-sm prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-foreground prose-a:text-primary prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{idea.ai_summary}</ReactMarkdown>
              </div>
            )}
          </section>
        )}

        {(editing || idea.raw_note) && (
          <section>
            <h3 className="text-sm font-semibold mb-2">Note</h3>
            {editing ? (
              <Textarea
                value={rawNote}
                onChange={(e) => setRawNote(e.target.value)}
                rows={6}
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{idea.raw_note}</p>
            )}
          </section>
        )}

        {idea.extracted_text && (
          <section>
            <h3 className="text-sm font-semibold mb-2">Original extracted text</h3>
            <div className="rounded-md border border-border bg-muted/20 p-4 text-xs whitespace-pre-wrap max-h-96 overflow-y-auto">
              {idea.extracted_text}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
