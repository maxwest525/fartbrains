import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type IdeaReminder = {
  id: string;
  idea_id: string;
  user_id: string;
  remind_at: string;
  notify_push: boolean;
  notify_email: boolean;
  label: string | null;
  fired_at: string | null;
  created_at: string;
  updated_at: string;
};

const key = (ideaId: string) => ["idea_reminders", ideaId];

export function useIdeaReminders(ideaId: string | null) {
  return useQuery({
    queryKey: key(ideaId ?? ""),
    enabled: !!ideaId,
    queryFn: async (): Promise<IdeaReminder[]> => {
      if (!ideaId) return [];
      const { data, error } = await supabase
        .from("idea_reminders" as never)
        .select("*")
        .eq("idea_id", ideaId)
        .order("remind_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as IdeaReminder[];
    },
  });
}

export function useCreateIdeaReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      idea_id: string;
      remind_at: string;
      notify_push?: boolean;
      notify_email?: boolean;
      label?: string | null;
    }) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("idea_reminders" as never)
        .insert({
          idea_id: input.idea_id,
          user_id: uid,
          remind_at: input.remind_at,
          notify_push: input.notify_push ?? true,
          notify_email: input.notify_email ?? false,
          label: input.label ?? null,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: key(vars.idea_id) });
      toast.success("Reminder added");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteIdeaReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, idea_id: _i }: { id: string; idea_id: string }) => {
      const { error } = await supabase
        .from("idea_reminders" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: key(vars.idea_id) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
