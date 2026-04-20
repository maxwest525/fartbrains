import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { useDuplicateUrl } from "@/hooks/useDuplicateUrl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useCreateIdea } from "@/hooks/useIdeas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NO_FOLDER = "__none__";

type Folder = { id: string; name: string };

const FolderSelect = ({
  value,
  onChange,
  folders,
}: {
  value: string;
  onChange: (v: string) => void;
  folders: Folder[];
}) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger><SelectValue /></SelectTrigger>
    <SelectContent>
      <SelectItem value={NO_FOLDER}>No folder</SelectItem>
      {folders.map((f) => (
        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultFolderId?: string | null;
  onCreated?: (id: string) => void;
  /** Opens an already-existing idea (used when a duplicate URL is detected). */
  onOpenExisting?: (id: string) => void;
};

export const NewIdeaDialog = ({ open, onOpenChange, defaultFolderId, onCreated, onOpenExisting }: Props) => {
  const { data: folders = [] } = useFolders();
  const createIdea = useCreateIdea();

  // Manual
  const [mTitle, setMTitle] = useState("");
  const [mNote, setMNote] = useState("");
  const [mFolder, setMFolder] = useState<string>(defaultFolderId ?? NO_FOLDER);
  const [mTags, setMTags] = useState("");

  // URL
  const [uUrl, setUUrl] = useState("");
  const [uTitle, setUTitle] = useState("");
  const [uExtracted, setUExtracted] = useState("");
  const [uSummary, setUSummary] = useState("");
  const [uFolder, setUFolder] = useState<string>(defaultFolderId ?? NO_FOLDER);
  const [uTags, setUTags] = useState("");
  const [uExtracting, setUExtracting] = useState(false);
  const [uSummarizing, setUSummarizing] = useState(false);
  const { data: urlDuplicate } = useDuplicateUrl(uUrl);

  // Transcript
  const [tTitle, setTTitle] = useState("");
  const [tText, setTText] = useState("");
  const [tSummary, setTSummary] = useState("");
  const [tFolder, setTFolder] = useState<string>(defaultFolderId ?? NO_FOLDER);
  const [tTags, setTTags] = useState("");
  const [tSummarizing, setTSummarizing] = useState(false);

  const reset = () => {
    setMTitle(""); setMNote(""); setMTags("");
    setUUrl(""); setUTitle(""); setUExtracted(""); setUSummary(""); setUTags("");
    setTTitle(""); setTText(""); setTSummary(""); setTTags("");
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const parseTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);
  const folderOrNull = (v: string) => (v === NO_FOLDER ? null : v);

  // Manual save
  const saveManual = async () => {
    if (!mTitle.trim()) return toast.error("Title required");
    const idea = await createIdea.mutateAsync({
      title: mTitle,
      raw_note: mNote || null,
      source_type: "manual",
      folder_id: folderOrNull(mFolder),
      tags: parseTags(mTags),
    });
    onCreated?.(idea.id);
    close();
  };

  // URL extract
  const extractUrl = async () => {
    if (!uUrl.trim()) return toast.error("URL required");
    setUExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-url", {
        body: { url: uUrl.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setUExtracted(data.text);
      if (!uTitle && data.title) setUTitle(data.title);
      toast.success("Page extracted");
      // Auto-summarize after extract
      await summarizeUrl(data.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setUExtracting(false);
    }
  };

  const summarizeUrl = async (text?: string) => {
    const source = text ?? uExtracted;
    if (!source.trim()) return toast.error("Nothing to summarize");
    setUSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize", {
        body: { text: source, kind: "webpage" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setUSummary(data.summary);
      if (!uTitle && data.suggestedTitle) setUTitle(data.suggestedTitle);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setUSummarizing(false);
    }
  };

  const saveUrl = async () => {
    if (!uTitle.trim()) return toast.error("Title required");
    if (!uExtracted.trim()) return toast.error("Extract page content first");
    const idea = await createIdea.mutateAsync({
      title: uTitle,
      source_url: uUrl.trim(),
      source_type: "webpage",
      extracted_text: uExtracted,
      ai_summary: uSummary || null,
      folder_id: folderOrNull(uFolder),
      tags: parseTags(uTags),
    });
    onCreated?.(idea.id);
    close();
  };

  // Transcript
  const summarizeTranscript = async () => {
    if (!tText.trim()) return toast.error("Paste text first");
    setTSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize", {
        body: { text: tText, kind: "transcript" },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setTSummary(data.summary);
      if (!tTitle && data.suggestedTitle) setTTitle(data.suggestedTitle);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Summary failed");
    } finally {
      setTSummarizing(false);
    }
  };

  const saveTranscript = async () => {
    if (!tTitle.trim()) return toast.error("Title required");
    if (!tText.trim()) return toast.error("Transcript text required");
    const idea = await createIdea.mutateAsync({
      title: tTitle,
      source_type: "transcript",
      extracted_text: tText,
      ai_summary: tSummary || null,
      folder_id: folderOrNull(tFolder),
      tags: parseTags(tTags),
    });
    onCreated?.(idea.id);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-2xl w-full sm:max-h-[90vh] max-h-[100dvh] h-[100dvh] sm:h-auto sm:rounded-lg rounded-none overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>New idea</DialogTitle>
          <DialogDescription>Capture an idea by typing it, pasting a URL, or pasting text.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="manual">
          <TabsList className="grid grid-cols-3 w-full h-auto">
            <TabsTrigger value="manual" className="h-11 text-xs sm:text-sm">Manual</TabsTrigger>
            <TabsTrigger value="url" className="h-11 text-xs sm:text-sm">From URL</TabsTrigger>
            <TabsTrigger value="transcript" className="h-11 text-xs sm:text-sm">Paste text</TabsTrigger>
          </TabsList>

          {/* MANUAL */}
          <TabsContent value="manual" className="space-y-3 pt-4">
            <div>
              <Label>Title</Label>
              <Input value={mTitle} onChange={(e) => setMTitle(e.target.value)} placeholder="Quick title" />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea value={mNote} onChange={(e) => setMNote(e.target.value)} rows={6} placeholder="Write your idea…" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Folder</Label><FolderSelect value={mFolder} onChange={setMFolder} folders={folders} /></div>
              <div><Label>Tags</Label><Input value={mTags} onChange={(e) => setMTags(e.target.value)} placeholder="comma, separated" /></div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={saveManual} disabled={createIdea.isPending}>Save idea</Button>
            </div>
          </TabsContent>

          {/* URL */}
          <TabsContent value="url" className="space-y-3 pt-4">
            <div>
              <Label>URL</Label>
              <div className="flex gap-2">
                <Input value={uUrl} onChange={(e) => setUUrl(e.target.value)} placeholder="https://…" />
                <Button onClick={extractUrl} disabled={uExtracting} variant="secondary">
                  {uExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Extract"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Works for most articles/blogs. JS-heavy sites (TikTok, Instagram) won't extract — use Paste text instead.
              </p>
            </div>
            {urlDuplicate && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
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
            {uExtracted && (
              <>
                <div>
                  <Label>Title</Label>
                  <Input value={uTitle} onChange={(e) => setUTitle(e.target.value)} />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>AI summary</Label>
                    <Button variant="ghost" size="sm" onClick={() => summarizeUrl()} disabled={uSummarizing}>
                      {uSummarizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                      Re-summarize
                    </Button>
                  </div>
                  <Textarea value={uSummary} onChange={(e) => setUSummary(e.target.value)} rows={6} className="font-mono text-xs" />
                </div>
                <div>
                  <Label>Extracted text (preserved)</Label>
                  <Textarea value={uExtracted} onChange={(e) => setUExtracted(e.target.value)} rows={4} className="text-xs" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label>Folder</Label><FolderSelect value={uFolder} onChange={setUFolder} folders={folders} /></div>
                  <div><Label>Tags</Label><Input value={uTags} onChange={(e) => setUTags(e.target.value)} placeholder="comma, separated" /></div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={saveUrl} disabled={createIdea.isPending}>Save idea</Button>
                </div>
              </>
            )}
          </TabsContent>

          {/* TRANSCRIPT */}
          <TabsContent value="transcript" className="space-y-3 pt-4">
            <div>
              <Label>Paste transcript or text</Label>
              <Textarea value={tText} onChange={(e) => setTText(e.target.value)} rows={8} placeholder="Paste from TikTok, YouTube, Instagram, etc." />
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={summarizeTranscript} disabled={tSummarizing || !tText.trim()}>
                {tSummarizing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Summarize
              </Button>
            </div>
            {(tSummary || tTitle) && (
              <>
                <div>
                  <Label>Title</Label>
                  <Input value={tTitle} onChange={(e) => setTTitle(e.target.value)} />
                </div>
                <div>
                  <Label>AI summary</Label>
                  <Textarea value={tSummary} onChange={(e) => setTSummary(e.target.value)} rows={6} className="font-mono text-xs" />
                </div>
              </>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Folder</Label><FolderSelect value={tFolder} onChange={setTFolder} folders={folders} /></div>
              <div><Label>Tags</Label><Input value={tTags} onChange={(e) => setTTags(e.target.value)} placeholder="comma, separated" /></div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={saveTranscript} disabled={createIdea.isPending}>Save idea</Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
