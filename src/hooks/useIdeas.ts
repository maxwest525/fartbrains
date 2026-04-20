import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SourceType = "manual" | "webpage" | "transcript" | "audio";
export type Priority = "none" | "low" | "medium" | "high";

export type Idea = {
  id: string;
  folder_id: string | null;
  title: string;
  raw_note: string | null;
  source_url: string | null;
  source_type: SourceType;
  extracted_text: string | null;
  ai_summary: string | null;
  generated_prompt: string | null;
  priority: Priority;
  tags: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
};

export type IdeaFilter =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "recent" }
  | { kind: "folder"; folderId: string }
  | { kind: "search"; query: string };

export function useIdeas(filter: IdeaFilter) {
  return useQuery({
    queryKey: ["ideas", filter],
    queryFn: async (): Promise<Idea[]> => {
      let q = supabase.from("ideas").select("*").order("updated_at", { ascending: false });

      if (filter.kind === "favorites") q = q.eq("is_favorite", true);
      if (filter.kind === "folder") q = q.eq("folder_id", filter.folderId);
      if (filter.kind === "recent") q = q.order("created_at", { ascending: false }).limit(20);
      if (filter.kind === "search" && filter.query.trim()) {
        const term = `%${filter.query.trim()}%`;
        q = q.or(
          `title.ilike.${term},raw_note.ilike.${term},extracted_text.ilike.${term},ai_summary.ilike.${term}`
        );
      }

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
          extracted_text: payload.extracted_text ?? null,
          ai_summary: payload.ai_summary ?? null,
          folder_id: payload.folder_id ?? null,
          tags: payload.tags ?? [],
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ideas"] });
      qc.invalidateQueries({ queryKey: ["folder-counts"] });
      qc.invalidateQueries({ queryKey: ["folder-previews"] });
      toast.success("Idea saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateIdea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Idea> }) => {
      const { error } = await supabase.from("ideas").update(patch).eq("id", id);
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
