import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EventGift = {
  id: string;
  user_id: string;
  event_id: string;
  title: string;
  url: string | null;
  price: number | null;
  notes: string | null;
  purchased: boolean;
  created_at: string;
  updated_at: string;
};

const key = (eventId: string) => ["event_gifts", eventId];

export function useEventGifts(eventId: string | null | undefined) {
  return useQuery({
    queryKey: key(eventId ?? ""),
    enabled: !!eventId,
    queryFn: async (): Promise<EventGift[]> => {
      const { data, error } = await supabase
        .from("event_gifts")
        .select("*")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventGift[];
    },
  });
}

export function useCreateEventGift(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Pick<EventGift, "title"> & Partial<Pick<EventGift, "url" | "price" | "notes">>) => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("event_gifts")
        .insert({ ...input, event_id: eventId, user_id: uid })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(eventId) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateEventGift(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EventGift> }) => {
      const { data, error } = await supabase
        .from("event_gifts")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(eventId) }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEventGift(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_gifts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key(eventId) }),
    onError: (e: Error) => toast.error(e.message),
  });
}
