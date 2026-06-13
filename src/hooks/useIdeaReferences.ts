import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type IdeaReference = {
  id: string;
  idea_id: string;
  name: string;
  url: string;
  title: string | null;
  description: string | null;
  kind: string;
  source: "firecrawl" | "ai_guess";
  position: number;
  created_at: string;
};

export function useIdeaReferences(ideaId: string | null) {
  return useQuery({
    queryKey: ["idea-references", ideaId],
    enabled: !!ideaId,
    queryFn: async (): Promise<IdeaReference[]> => {
      if (!ideaId) return [];
      const { data, error } = await supabase
        .from("idea_references")
        .select("*")
        .eq("idea_id", ideaId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as IdeaReference[];
    },
  });
}

export function useRefreshIdeaReferences(ideaId: string | null) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const mut = useMutation({
    mutationFn: async () => {
      if (!ideaId) return;
      setRunning(true);
      const { error } = await supabase.functions.invoke("extract-references", {
        body: { ideaId },
      });
      if (error) throw error;
    },
    onSettled: () => {
      setRunning(false);
      qc.invalidateQueries({ queryKey: ["idea-references", ideaId] });
    },
  });
  return { refresh: mut.mutate, running: running || mut.isPending };
}

/**
 * Fire-and-forget background extraction. Used right after an idea is created
 * so the references show up by themselves without blocking the save flow.
 */
export function triggerExtractReferences(ideaId: string) {
  void supabase.functions
    .invoke("extract-references", { body: { ideaId } })
    .catch((e) => console.warn("extract-references failed", e));
}

/**
 * Polls references for a short window after an idea is opened so the UI
 * reflects the background extraction without needing a manual refresh.
 */
export function useAutoRefreshReferences(ideaId: string | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!ideaId) return;
    let cancelled = false;
    let attempt = 0;
    const tick = () => {
      if (cancelled) return;
      attempt += 1;
      qc.invalidateQueries({ queryKey: ["idea-references", ideaId] });
      if (attempt < 6) setTimeout(tick, 2500);
    };
    const t = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ideaId, qc]);
}
