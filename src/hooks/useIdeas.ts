import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { triggerExtractReferences } from "@/hooks/useIdeaReferences";

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
          folder_id: payload.folder_id ?? null,
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
      // Kick off background reference extraction (fire-and-forget).
      if (data && typeof (data as { id?: string }).id === "string") {
        triggerExtractReferences((data as { id: string }).id);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
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
