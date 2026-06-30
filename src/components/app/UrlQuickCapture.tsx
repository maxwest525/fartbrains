import { useState } from "react";
import { Loader2, Globe, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateIdea } from "@/hooks/useIdeas";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * V1 funnel entry: paste a URL (and optional one-line idea), extract page text
 * via `scrape-url`, save as a new idea, and jump straight to the detail.
 * When BOTH note + URL are filled we auto-generate a prompt server-side so the
 * user lands on a fully-formed idea ready to chat with Ash.
 */
export function UrlQuickCapture({ onCreated }: { onCreated: (id: string) => void }) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const createIdea = useCreateIdea();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || busy) return;
    let normalized = trimmed;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try {
      new URL(normalized);
    } catch {
      toast.error("That doesn't look like a valid URL");
      return;
    }

    setBusy(true);
    try {
      setStage("Extracting page…");
      const { data: scraped, error: scErr } = await supabase.functions.invoke("scrape-url", {
        body: { url: normalized },
      });
      if (scErr) throw new Error(scErr.message);
      if (scraped?.error) throw new Error(scraped.error);

      const extracted: string = scraped?.markdown ?? "";
      const summary: string = scraped?.summary ?? "";
      const pageTitle: string = scraped?.title ?? normalized;
      const noteTrim = note.trim();

      setStage("Saving idea…");
      const created = await createIdea.mutateAsync({
        title: pageTitle.slice(0, 200),
        raw_note: noteTrim || null,
        source_url: normalized,
        source_type: "webpage",
        source_label: "Web page",
        source_meta: { kind: "webpage" },
        extracted_text: extracted || null,
        ai_summary: summary || null,
      });

      const ideaId = (created as { id?: string } | null)?.id;

      // 2-input MVP shortcut: auto-generate prompt when user gave us both signals.
      if (ideaId && noteTrim && (extracted || summary)) {
        setStage("Generating prompt…");
        try {
          const { data: gen, error: gErr } = await supabase.functions.invoke("generate-prompt", {
            body: {
              title: pageTitle,
              note: noteTrim,
              summary,
              extractedText: extracted,
              sourceUrl: normalized,
              sourceLabel: "Web page",
            },
          });
          if (!gErr && gen?.prompt) {
            await supabase.from("ideas").update({ generated_prompt: gen.prompt } as never).eq("id", ideaId);
          }
        } catch {
          // Non-fatal — user can still generate from the detail.
        }
      }

      setUrl("");
      setNote("");
      if (ideaId) onCreated(ideaId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't extract that URL");
    } finally {
      setBusy(false);
      setStage("");
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full glass-card-clear rounded-2xl p-3 sm:p-4 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a URL to capture…"
          disabled={busy}
          className="flex-1 bg-transparent text-[15px] placeholder:text-muted-foreground/70 focus:outline-none"
        />
      </div>
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional: your angle / what you want from it"
          disabled={busy}
          className="flex-1 bg-transparent text-[13.5px] text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:text-foreground"
        />
        <Button
          type="submit"
          size="sm"
          disabled={busy || !url.trim()}
          className="shrink-0 h-8 px-3"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
          {busy ? (stage || "Working…") : "Extract"}
        </Button>
      </div>
    </form>
  );
}
