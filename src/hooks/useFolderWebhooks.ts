import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { FolderWebhook } from "@/lib/webhooks";

/**
 * Reading and editing per-folder webhooks.
 *
 * Delivery itself is never called from here — that is the `deliver-webhook`
 * edge function, so the destination is fetched server-side where it can be
 * SSRF-checked and the payload can be signed.
 */

const KEY = ["folder-webhooks"];

export function useFolderWebhooks() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<FolderWebhook[]> => {
      const { data, error } = await supabase
        .from("folder_webhooks")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as FolderWebhook[];
    },
  });
}

export function useSaveFolderWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      folder_id: string;
      url: string;
      enabled: boolean;
      include_note: boolean;
      include_summary: boolean;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("folder_webhooks")
        .upsert({ ...input, user_id: userId }, { onConflict: "folder_id" });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Webhook saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveFolderWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase
        .from("folder_webhooks")
        .delete()
        .eq("folder_id", folderId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Webhook removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTestFolderWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folderId: string) => {
      const { data, error } = await supabase.functions.invoke("deliver-webhook", {
        body: { folder_id: folderId, test: true },
      });
      if (error) throw new Error(error.message);
      return data as { status: string; http_status?: number; error?: string };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: KEY });
      if (result.status === "delivered") {
        toast.success("Test delivered", {
          description: `Your endpoint answered ${result.http_status}.`,
        });
      } else if (result.status === "disabled") {
        toast.info("This webhook is turned off.");
      } else {
        toast.error("Test failed", { description: result.error ?? result.status });
      }
    },
    onError: (e: Error) => toast.error("Test failed", { description: e.message }),
  });
}

/**
 * Fire-and-forget delivery for an idea that just landed in a folder.
 *
 * Never awaited and never surfaces an error: a webhook the customer set up for
 * their own workflow must not be able to make saving a note look like it
 * failed. Whether it worked is on the settings screen.
 */
export function deliverToFolderWebhook(ideaId: string, folderId: string | null | undefined): void {
  if (!ideaId || !folderId) return;
  void supabase.functions
    .invoke("deliver-webhook", { body: { idea_id: ideaId, folder_id: folderId } })
    .catch(() => { /* the settings screen reports delivery state */ });
}
