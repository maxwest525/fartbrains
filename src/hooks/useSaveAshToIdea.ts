import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateIdea } from "@/hooks/useIdeas";
import { toast } from "sonner";

/**
 * Saves an Ash chat exchange (user prompt + assistant reply) as a new idea in
 * the vault. The user's prompt becomes the raw_note, the full assistant reply
 * becomes the extracted_text, and (for long replies) we ask the summarize
 * function to produce a tight ai_summary + suggested title.
 */
export function useSaveAshToIdea() {
  const createIdea = useCreateIdea();
  const [saving, setSaving] = useState(false);

  const save = async (opts: {
    userPrompt: string;
    assistantReply: string;
    folderId?: string | null;
  }) => {
    const prompt = opts.userPrompt.trim();
    const reply = opts.assistantReply.trim();
    if (!reply) {
      toast.error("Nothing to save yet");
      return null;
    }
    if (saving) return null;
    setSaving(true);

    let ai_summary: string | null = null;
    let suggestedTitle: string | null = null;
    try {
      // Only re-summarize long replies — short ones are already a summary.
      if (reply.length > 800) {
        try {
          const { data, error } = await supabase.functions.invoke("summarize", {
            body: { text: reply, kind: "default", userNote: prompt },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          ai_summary = (data?.summary as string | undefined)?.trim() ?? null;
          suggestedTitle = (data?.suggestedTitle as string | undefined) ?? null;
        } catch (e) {
          // Non-fatal — save without AI summary
          console.warn("Ash save: summarize failed", e);
        }
      } else {
        ai_summary = reply;
      }

      const fallbackTitle =
        prompt.split("\n")[0]?.slice(0, 80) ||
        reply.split("\n")[0]?.slice(0, 80) ||
        "Ash conversation";
      const title = (suggestedTitle || fallbackTitle).slice(0, 200);

      const idea = await createIdea.mutateAsync({
        title,
        raw_note: prompt || null,
        source_type: "manual",
        source_label: "Ash",
        extracted_text: reply,
        ai_summary,
        folder_id: opts.folderId ?? null,
        tags: ["ash"],
      });

      toast.success("Saved to Idea Vault");
      return idea;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { save, saving };
}
