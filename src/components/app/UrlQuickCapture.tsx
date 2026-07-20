import { useRef, useState } from "react";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateIdea } from "@/hooks/useIdeas";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Single-field composer. Paste a URL natively and we detect it, extract the
 * page, and save as an idea. Plain text saves as a note. No separate URL slot.
 */
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/i;
const BARE_URL_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i;

function findUrl(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(URL_RE);
  if (m) return m[0];
  // Bare domain like "example.com/foo" — only if it's the whole input.
  if (BARE_URL_RE.test(t)) return `https://${t}`;
  return null;
}

export function UrlQuickCapture({ onCreated }: { onCreated: (id: string) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const createIdea = useCreateIdea();

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = value.trim();
    if (!text || busy) return;

    const detectedUrl = findUrl(text);
    setBusy(true);
    try {
      if (detectedUrl) {
        // Anything in the input besides the URL becomes the user's "angle/note".
        const note = text.replace(detectedUrl, "").trim();

        let host = "";
        try { host = new URL(detectedUrl).hostname.toLowerCase(); } catch { /* ignore */ }
        const isInstagram = /(^|\.)instagram\.com$/.test(host);
        const isYouTube = /(^|\.)(youtube\.com|youtu\.be)$/.test(host);

        let extracted = "";
        let summary = "";
        let pageTitle = detectedUrl;
        let sourceLabel = "Web page";
        let sourceKind: "webpage" | "instagram" | "youtube" = "webpage";

        if (isInstagram) {
          setStage("Transcribing reel…");
          const { data, error } = await supabase.functions.invoke("transcribe-instagram", { body: { url: detectedUrl } });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          extracted = [data?.caption, data?.transcript].filter(Boolean).join("\n\n");
          pageTitle = data?.title || data?.author || "Instagram reel";
          sourceLabel = "Instagram";
          sourceKind = "instagram";
        } else if (isYouTube) {
          setStage("Transcribing video…");
          const { data, error } = await supabase.functions.invoke("transcribe-youtube", { body: { url: detectedUrl } });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          extracted = data?.transcript ?? data?.text ?? "";
          pageTitle = data?.title || "YouTube video";
          sourceLabel = "YouTube";
          sourceKind = "youtube";
        } else {
          setStage("Extracting page…");
          const { data: scraped, error: scErr } = await supabase.functions.invoke("scrape-url", {
            body: { url: detectedUrl },
          });
          if (scErr) throw new Error(scErr.message);
          if (scraped?.error) throw new Error(scraped.error);
          extracted = scraped?.markdown ?? "";
          summary = scraped?.summary ?? "";
          pageTitle = scraped?.title ?? detectedUrl;
        }

        setStage("Saving idea…");
        const created = await createIdea.mutateAsync({
          title: pageTitle.slice(0, 200),
          raw_note: note || null,
          source_url: detectedUrl,
          source_type: "webpage",
          source_label: sourceLabel,
          source_meta: { kind: sourceKind },
          extracted_text: extracted || null,
          ai_summary: summary || null,
        });

        const ideaId = (created as { id?: string } | null)?.id;
        if (ideaId && note && (extracted || summary)) {
          setStage("Generating prompt…");
          try {
            const { data: gen, error: gErr } = await supabase.functions.invoke("generate-prompt", {
              body: {
                title: pageTitle,
                note,
                summary,
                extractedText: extracted,
                sourceUrl: detectedUrl,
                sourceLabel,
              },
            });
            if (!gErr && gen?.prompt) {
              await supabase.from("ideas").update({ generated_prompt: gen.prompt } as never).eq("id", ideaId);
            }
          } catch { /* non-fatal */ }
        }

        setValue("");
        if (ideaId) onCreated(ideaId);
      } else {
        // Plain note — save as manual idea.
        setStage("Saving note…");
        const created = await createIdea.mutateAsync({
          title: text.split("\n")[0]?.slice(0, 80) || "Untitled idea",
          raw_note: text,
          source_type: "manual",
        });
        const ideaId = (created as { id?: string } | null)?.id;
        setValue("");
        if (ideaId) onCreated(ideaId);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  };

  const hasUrl = !!findUrl(value);

  return (
    <form
      onSubmit={submit}
      className="w-full glass-card-clear rounded-2xl p-3 sm:p-4 flex flex-col gap-2"
    >
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Paste a URL or jot an idea…"
        disabled={busy}
        rows={3}
        className="w-full bg-transparent text-[15px] placeholder:text-muted-foreground/70 focus:outline-none resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground/70">
          {busy ? (stage || "Working…") : hasUrl ? "URL detected — will extract" : "⌘/Ctrl + Enter to save"}
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={busy || !value.trim()}
          className="shrink-0 h-8 px-3 gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : hasUrl ? (
            <ArrowRight className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {hasUrl ? "Extract" : "Save"}
        </Button>
      </div>
    </form>
  );
}
