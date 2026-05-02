import { useState } from "react";
import { Sparkles, Loader2, Link2, FileText, X, AlertTriangle, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateIdea } from "@/hooks/useIdeas";
import { useDuplicateUrl } from "@/hooks/useDuplicateUrl";
import { useUrlCheck } from "@/hooks/useUrlCheck";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Props = {
  defaultFolderId?: string | null;
  onCreated?: (id: string, needsReview?: boolean) => void;
  onOpenExisting?: (id: string) => void;
};

type Preview = {
  url: string;
  text: string;
  suggestedTitle?: string;
  /** True when text came from an Instagram reel transcription. */
  isInstagramTranscript?: boolean;
};

const isInstagramUrl = (s: string): boolean => {
  try {
    const u = new URL(s);
    return /(^|\.)instagram\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
};

/**
 * Always-visible "Paste a URL" panel for the Capture page.
 *
 * Skips the source picker entirely: paste or type a URL → extract preview
 * → optionally edit title/text → save with AI summary. Mirrors the URL flow
 * inside ComposeIdea so users have a one-purpose surface for link captures.
 */
export const UrlCapturePanel = ({ defaultFolderId, onCreated, onOpenExisting }: Props) => {
  const createIdea = useCreateIdea();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  // Set when an extract attempt failed (invalid URL or extract error). Lets us
  // surface a "Save link anyway" fallback so the user can still capture the URL
  // as a manual idea even when we can't fetch its contents.
  const [extractFailed, setExtractFailed] = useState<string | null>(null);

  const { data: urlDuplicate } = useDuplicateUrl(url);
  const urlCheck = useUrlCheck(url, true);

  const reset = () => {
    setUrl("");
    setTitle("");
    setNote("");
    setPreview(null);
    setExtractFailed(null);
  };

  const isValidHttpUrl = (s: string) => {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };

  /**
   * Clean text pasted/typed into the URL field before validation:
   * - strip zero-width chars and trim whitespace
   * - remove wrapping quotes/brackets users often copy with a link
   *   (e.g. `"https://…"`, `<https://…>`, `(https://…)`, smart quotes)
   * - drop trailing punctuation that's almost never part of a URL
   * - collapse any internal whitespace/newlines (URLs can't contain them)
   */
  const cleanUrlInput = (s: string): string => {
    let v = (s ?? "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
    if (!v) return "";
    const pairs: Array<[string, string]> = [
      ['"', '"'], ["'", "'"], ["`", "`"],
      ["<", ">"], ["(", ")"], ["[", "]"], ["{", "}"],
      ["\u201C", "\u201D"], ["\u2018", "\u2019"],
    ];
    let changed = true;
    while (changed) {
      changed = false;
      for (const [open, close] of pairs) {
        if (v.length >= 2 && v.startsWith(open) && v.endsWith(close)) {
          v = v.slice(1, -1).trim();
          changed = true;
        }
      }
    }
    v = v.replace(/^["'`<(\[{\u201C\u2018]+/, "").replace(/["'`>)\]}\u201D\u2019.,;]+$/, "");
    v = v.replace(/\s+/g, "");
    return v;
  };

  const handleExtract = async (overrideUrl?: string) => {
    const target = cleanUrlInput(overrideUrl ?? url);
    if (!target) return toast.error("Paste a URL first");
    if (!isValidHttpUrl(target)) return toast.error("That doesn't look like a valid URL");
    if (target !== (overrideUrl ?? url).trim()) setUrl(target);
    if (extracting || saving) return;

    setExtracting(true);
    try {
      // Instagram → fetch the reel via Apify and transcribe with ElevenLabs Scribe.
      if (isInstagramUrl(target)) {
        const t = toast.loading("Fetching reel & transcribing…", {
          description: "This usually takes 10–30 seconds.",
        });
        try {
          const { data, error } = await supabase.functions.invoke("transcribe-instagram", {
            body: { url: target },
          });
          if (error) throw new Error(error.message);
          if (data?.error && !data?.transcript && !data?.caption) {
            throw new Error(data.error);
          }

          const transcript: string = (data?.transcript ?? "").toString().trim();
          const caption: string = (data?.caption ?? "").toString().trim();
          // Prefer transcript; fall back to caption if STT returned nothing.
          const body =
            transcript.length > 0
              ? caption
                ? `${transcript}\n\n— Caption —\n${caption}`
                : transcript
              : caption;

          if (!body) throw new Error("No transcript or caption available for this reel.");

          const suggested =
            data?.title ??
            (data?.author ? `Instagram — ${data.author}` : "Instagram reel");

          setPreview({
            url: data?.finalUrl ?? target,
            text: body,
            suggestedTitle: suggested,
            isInstagramTranscript: transcript.length > 0,
          });
          if (!title.trim()) setTitle(String(suggested).slice(0, 200));

          toast.dismiss(t);
          if (transcript.length > 0) {
            toast.success("Reel transcribed", {
              description: "Edit the transcript if needed, then save.",
            });
          } else {
            toast.warning("Couldn't transcribe — using caption only");
          }
        } catch (e) {
          toast.dismiss(t);
          throw e;
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke("extract-url", {
        body: { url: target },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const text = (data?.text ?? "").trim();
      if (!text) throw new Error("Couldn't extract any readable text from this page");

      setPreview({
        url: target,
        text,
        suggestedTitle: data?.title ?? undefined,
      });
      if (!title.trim() && data?.title) setTitle(String(data.title).slice(0, 200));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't extract content");
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async () => {
    if (!preview || saving) return;
    setSaving(true);
    try {
      let summary = "";
      let aiTitle: string | undefined;
      try {
        const { data, error } = await supabase.functions.invoke("summarize", {
          body: {
            text: preview.text,
            kind: preview.isInstagramTranscript ? "transcript" : "webpage",
            userNote: note.trim() || undefined,
          },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        summary = data?.summary ?? "";
        aiTitle = data?.suggestedTitle ?? undefined;
      } catch (e) {
        toast.warning(e instanceof Error ? `AI summary failed: ${e.message}` : "AI summary failed");
      }

      const finalTitle = (
        title.trim() || aiTitle || preview.suggestedTitle || preview.url
      ).slice(0, 200);

      const idea = await createIdea.mutateAsync({
        title: finalTitle,
        raw_note: note.trim() || null,
        source_url: preview.url,
        source_type: preview.isInstagramTranscript ? "transcript" : "webpage",
        extracted_text: preview.text || null,
        ai_summary: summary.trim() || null,
        folder_id: defaultFolderId ?? null,
        tags: [],
      });

      const summaryClean = summary.trim();
      const needsReview = !summaryClean || summaryClean.length < 150;
      onCreated?.(idea.id, needsReview);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save idea");
    } finally {
      setSaving(false);
    }
  };

  const wordCount = preview ? preview.text.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="rounded-2xl bg-card border border-border/60 p-3 sm:p-4 space-y-3 shadow-sm">
      {/* Header — matches the visual weight of the source picker but is always-on */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-[10px] bg-[hsl(211_100%_50%)] text-white flex items-center justify-center shrink-0">
          <Link2 className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold leading-tight">Paste a link or Instagram reel</div>
          <div className="text-[12px] text-muted-foreground leading-tight">
            Articles, blog posts, or Instagram reels — we'll pull the text (or transcribe the audio) so you can save it as an idea.
          </div>
        </div>
      </div>

      {/* URL input */}
      <Input
        value={url}
        onChange={(e) => setUrl(cleanUrlInput(e.target.value))}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = cleanUrlInput(e.clipboardData.getData("text"));
          if (!pasted) return;
          setUrl(pasted);
          if (isValidHttpUrl(pasted)) {
            setTimeout(() => handleExtract(pasted), 0);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !preview) {
            e.preventDefault();
            handleExtract();
          }
        }}
        placeholder="https://example.com/article  or  https://instagram.com/reel/…"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px] font-medium px-4"
      />

      {/* Helper text + quick examples — only when there's no input or preview yet */}
      {!preview && !url.trim() && (
        <div className="space-y-1.5 text-[12px] text-muted-foreground leading-snug">
          <p>
            Must start with <span className="font-mono text-foreground/80">http://</span> or{" "}
            <span className="font-mono text-foreground/80">https://</span>. We'll check that the page is reachable before you save.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <span className="text-[11px] uppercase tracking-wide opacity-70 mr-0.5 self-center">Try:</span>
            {[
              "https://www.nytimes.com/…",
              "https://instagram.com/reel/…",
              "https://yourblog.com/post",
            ].map((ex) => (
              <span
                key={ex}
                className="rounded-md bg-secondary/60 px-2 py-0.5 text-[11.5px] font-mono text-foreground/70"
              >
                {ex}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Live URL reachability */}
      {url.trim() && urlCheck.status !== "idle" && !preview && (
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
          {urlCheck.status === "checking" && <Loader2 className="h-3.5 w-3.5 mt-0.5 shrink-0 animate-spin" />}
          {urlCheck.status === "ok" && <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
          {urlCheck.status === "error" && <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
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

      {/* Duplicate warning */}
      {urlDuplicate && !preview && (
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

      {/* Preview card */}
      {preview && (
        <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3 sm:p-4 space-y-3">
          <div className="flex items-start gap-2">
            <div className="h-9 w-9 rounded-[10px] bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <FileText className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preview</div>
              <div className="font-semibold text-[15px] truncate" title={preview.suggestedTitle || preview.url}>
                {preview.suggestedTitle || "Untitled page"}
              </div>
              <div className="text-[12px] text-muted-foreground truncate" title={preview.url}>
                {preview.url}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="press text-muted-foreground hover:text-foreground p-1.5 -mr-1 -mt-1 rounded-md"
              aria-label="Dismiss preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional — AI will suggest one)"
            maxLength={200}
            className="h-10 rounded-xl bg-card border-border/60 text-[14px]"
          />

          <Textarea
            value={preview.text}
            onChange={(e) => setPreview({ ...preview, text: e.target.value })}
            rows={8}
            className="rounded-xl bg-card border-border/60 text-[13.5px] leading-relaxed resize-y max-h-[40vh]"
          />

          <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
            <span>
              {preview.text.length.toLocaleString()} chars · {wordCount.toLocaleString()} words
            </span>
            <span className="opacity-70">Edit before saving if needed</span>
          </div>

          {/* User notes — combined with the extracted text/transcript when generating prompts later */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Your notes <span className="opacity-60 normal-case font-normal">(optional)</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Your angle, what caught your attention, how you'd use this…"
              className="rounded-xl bg-card border-border/60 text-[13.5px] leading-relaxed resize-y"
            />
            <p className="text-[11px] text-muted-foreground opacity-80">
              Saved alongside the {preview.isInstagramTranscript ? "transcript" : "extract"} so you can combine your idea with it later.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={reset}
              className="h-11 rounded-xl flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || preview.text.trim().length < 20}
              className="h-11 rounded-xl flex-[2] text-[15px] font-semibold"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1.5" />
                  Summarize & save
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Primary CTA when no preview yet */}
      {!preview && (
        <Button
          type="button"
          onClick={() => handleExtract()}
          disabled={!url.trim() || extracting || saving}
          className="w-full h-11 rounded-xl text-[15px] font-semibold"
        >
          {extracting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Extract preview
            </>
          )}
        </Button>
      )}
    </div>
  );
};
