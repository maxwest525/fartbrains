import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Folder = {
  id: string;
  name: string;
  created_at: string;
};

export function useFolders() {
  return useQuery({
    queryKey: ["folders"],
    queryFn: async (): Promise<Folder[]> => {
      const { data, error } = await supabase
        .from("folders")
        .select("id,name,created_at")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Per-folder idea counts. Returns a map of folder_id → count.
 * Pulls all ideas (RLS scopes to the current user) and aggregates client-side.
 */
export function useFolderCounts() {
  return useQuery({
    queryKey: ["folder-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("ideas").select("folder_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach((row) => {
        if (row.folder_id) counts[row.folder_id] = (counts[row.folder_id] ?? 0) + 1;
      });
      return counts;
    },
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("folders")
        .insert({ name: name.trim(), user_id: userData.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      toast.success("Folder created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("folders").update({ name: name.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folders"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folders"] });
      qc.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("Folder deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
