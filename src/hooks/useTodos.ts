import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Todo = {
  id: string;
  title: string;
  done: boolean;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function useTodos() {
  return useQuery({
    queryKey: ["todos"],
    queryFn: async (): Promise<Todo[]> => {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .order("done", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Todo[];
    },
  });
}

export function useCreateTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (title: string) => {
      const t = title.trim();
      if (!t) throw new Error("Todo can't be empty");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("todos")
        .insert({ title: t, user_id: u.user.id } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase
        .from("todos")
        .update({
          done,
          completed_at: done ? new Date().toISOString() : null,
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("todos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["todos"] }),
    onError: (e: Error) => toast.error(e.message),
  });
}
