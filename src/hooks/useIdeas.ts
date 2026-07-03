import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { triggerExtractReferences } from "@/hooks/useIdeaReferences";
import { syncIdeaToAmos } from "@/lib/syncIdeaToAmos";

export type SourceType = "manual" | "webpage" | "transcript" | "audio";
export type Priority = "none" | "low" | "medium" | "high";

export type SourceMeta = {
  /** Which extractor produced this — drives icon + label in detail view. */
  kind?: "instagram" | "tiktok" | "youtube" | "webpage";
  author?: string | null;
  siteName?: string | null;
  thumbnail?: string | null;
  hasTranscript?: boolean;
  /** Attached audio clip for voice-prompt ideas (no transcription). */
  audio?: { url: string; mimeType?: string; durationSeconds?: number };
};

export type TagMeta = {
  reasoning?: string;
  confidence?: number;
  source?: "auto" | "manual";
  generated_at?: string;
};

export type Idea = {
  id: string;
  folder_id: string | null;
  title: string;
  raw_note: string | null;
  source_url: string | null;
  source_type: SourceType;
  /** Human-readable source name (e.g. "Instagram", "TikTok", "YouTube", "Web page"). */
  source_label?: string | null;
  /** Normalized metadata from the extractor (author, thumbnail, etc.). */
  source_meta?: SourceMeta | null;
  extracted_text: string | null;
  ai_summary: string | null;
  generated_prompt: string | null;
  priority: Priority;
  tags: string[];
  /** Optional auto-tagger metadata: reasoning, confidence, source. */
  tag_meta?: TagMeta | null;
  is_favorite: boolean;
  remind_at: string | null;
  notify_push: boolean;
  notify_email: boolean;
  reminder_fired_at: string | null;
  /** When set, the idea is pinned and sorts above unpinned items. */
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
};


export type IdeaFilter =
  | { kind: "all"; sourceType?: SourceType }
  | { kind: "favorites"; sourceType?: SourceType }
  | { kind: "recent"; sourceType?: SourceType }
  | { kind: "folder"; folderId: string; sourceType?: SourceType }
  | { kind: "search"; query: string; folderId?: string; sourceType?: SourceType };

export function useIdeas(filter: IdeaFilter) {
  return useQuery({
    queryKey: ["ideas", filter],
    queryFn: async (): Promise<Idea[]> => {
      // Pinned items always float to the top (most recently pinned first),
      // then fall back to recency. NULLS LAST keeps unpinned below.
      let q = supabase
        .from("ideas")
        .select("*")
        .order("pinned_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false });

      if (filter.kind === "favorites") q = q.eq("is_favorite", true);
      if (filter.kind === "folder") q = q.eq("folder_id", filter.folderId);
      if (filter.kind === "recent") q = q.order("created_at", { ascending: false }).limit(20);
      if (filter.kind === "search" && filter.query.trim()) {
        // Keep the search scoped to the active folder when one is provided,
        // so users don't lose context by typing in the search bar.
        if (filter.folderId) q = q.eq("folder_id", filter.folderId);
        const term = `%${filter.query.trim()}%`;
        q = q.or(
          `title.ilike.${term},raw_note.ilike.${term},extracted_text.ilike.${term},ai_summary.ilike.${term}`
        );
      }

      // Optional source-type facet (e.g. "Transcript only").
      if (filter.sourceType) q = q.eq("source_type", filter.sourceType);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Idea[];
    },
  });
}

export function useIdea(id: string | null) {
  return useQuery({
    queryKey: ["idea", id],
    enabled: !!id,
    queryFn: async (): Promise<Idea | null> => {
      if (!id) return null;
      const { data, error } = await supabase.from("ideas").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Idea | null;
    },
  });
}

/**
 * Auto-route a new capture to one of the canonical default folders when the
 * user hasn't picked one explicitly. Pure content heuristic — no AI call:
 *   - Checklists: markdown checkbox lines, or a "list"-shaped paste
 *   - Todo:       starts with a todo/action cue ("todo:", "remind me", "need to"…)
 *   - Notes:      short manual jot with no extracted/summarized content
 *   - Ideas:      everything else (URLs, transcripts, long captures, prompts)
 */
function classifyDefaultFolder(payload: {
  raw_note?: string | null;
  source_type: SourceType;
  source_url?: string | null;
  extracted_text?: string | null;
  ai_summary?: string | null;
  title: string;
}): "Ideas" | "Notes" | "Todo" | "Checklists" {
  const note = (payload.raw_note ?? "").trim();
  const lower = note.toLowerCase();
  const lines = note.split("\n").map((l) => l.trim()).filter(Boolean);

  if (/^- \[[ xX]\] /m.test(note)) return "Checklists";
  if (lines.length >= 3 && lines.every((l) => l.length < 80 && !/[.!?]$/.test(l))) {
    return "Checklists";
  }

  if (/^(todo[:\-\s]|to-do|to do|remind me|don'?t forget|need to|must |should |buy |call |email |finish |fix |ship )/i.test(lower)) {
    return "Todo";
  }

  if (
    payload.source_type === "manual" &&
    !payload.source_url &&
    !payload.extracted_text &&
    !payload.ai_summary &&
    note.length > 0 &&
    note.length < 280 &&
    lines.length <= 3
  ) {
    return "Notes";
  }

  return "Ideas";
}

export function useCreateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      title: string;
      raw_note?: string | null;
      source_url?: string | null;
      source_type: SourceType;
      /** Human-readable source name shown in lists / detail (e.g. "Instagram"). */
      source_label?: string | null;
      source_meta?: SourceMeta | null;
      extracted_text?: string | null;
      ai_summary?: string | null;
      folder_id?: string | null;
      tags?: string[];
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Auto-route to a default folder when the caller didn't pick one.
      let folderId = payload.folder_id ?? null;
      if (!folderId) {
        const target = classifyDefaultFolder(payload);
        const { data: match } = await supabase
          .from("folders")
          .select("id")
          .ilike("name", target)
          .limit(1)
          .maybeSingle();
        if (match?.id) {
          folderId = match.id;
        } else {
          // Folder doesn't exist yet (first capture before Folders page mount).
          // Create it on the fly so auto-routing still works.
          const { data: created } = await supabase
            .from("folders")
            .insert({ name: target, user_id: userData.user.id })
            .select("id")
            .single();
          folderId = created?.id ?? null;
        }
      }

      const { data, error } = await supabase
        .from("ideas")
        .insert({
          user_id: userData.user.id,
          title: payload.title.trim(),
          raw_note: payload.raw_note ?? null,
          source_url: payload.source_url ?? null,
          source_type: payload.source_type,
          source_label: payload.source_label ?? null,
          source_meta: payload.source_meta ?? null,
          extracted_text: payload.extracted_text ?? null,
          ai_summary: payload.ai_summary ?? null,
          folder_id: folderId,
          tags: payload.tags ?? [],
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["ideas"] });
      qc.invalidateQueries({ queryKey: ["folder-counts"] });
      qc.invalidateQueries({ queryKey: ["folder-previews"] });
      // Trigger the viewport-edge gradient burst (rendered by <IdeaCreatedFx />).
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("idea:created"));
      }
      toast.success("Idea saved", { description: "Captured to your vault." });
      const row = data as { id?: string; title?: string; raw_note?: string | null; ai_summary?: string | null; extracted_text?: string | null; source_url?: string | null; tags?: string[] } | null;
      if (row?.id) {
        // Mirror to AMOS Idea Inbox (fire-and-forget; never blocks or errors).
        syncIdeaToAmos({
          title: row.title,
          raw_note: row.raw_note,
          ai_summary: row.ai_summary,
          extracted_text: row.extracted_text,
          source_url: row.source_url,
        });
        // Kick off background reference extraction (fire-and-forget).
        triggerExtractReferences(row.id);
        // Auto-tag from content if no tags were set explicitly.
        if (!row.tags || row.tags.length === 0) {
          triggerAutoTag(row.id, {
            title: row.title ?? "",
            text: [row.raw_note, row.ai_summary, row.extracted_text].filter(Boolean).join("\n\n"),
          }).then((added) => {
            if (added.length > 0) {
              qc.invalidateQueries({ queryKey: ["ideas"] });
              qc.invalidateQueries({ queryKey: ["idea", row.id] });
            }
          });
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

async function triggerAutoTag(id: string, payload: { title: string; text: string }): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke("auto-tag", { body: payload });
    if (error) return [];
    const tags = Array.isArray(data?.tags) ? (data.tags as string[]) : [];
    if (tags.length === 0) return [];
    const tag_meta = {
      source: "auto" as const,
      reasoning: typeof data?.reasoning === "string" ? data.reasoning : "",
      confidence: typeof data?.confidence === "number" ? data.confidence : null,
      generated_at: new Date().toISOString(),
    };
    const { error: upErr } = await supabase
      .from("ideas")
      .update({ tags, tag_meta } as never)
      .eq("id", id);
    if (upErr) return [];
    return tags;
  } catch (_e) {
    return [];
  }
}

export function useUpdateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Idea> }) => {
      const { error } = await supabase.from("ideas").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["ideas"] });
      qc.invalidateQueries({ queryKey: ["idea", vars.id] });
      qc.invalidateQueries({ queryKey: ["folder-counts"] });
      qc.invalidateQueries({ queryKey: ["folder-previews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ideas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ideas"] });
      qc.invalidateQueries({ queryKey: ["folder-counts"] });
      qc.invalidateQueries({ queryKey: ["folder-previews"] });
      toast.success("Idea deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
