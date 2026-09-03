import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateShareToken, hashShareToken } from "@/lib/share";

export type IdeaShare = {
  id: string;
  idea_id: string;
  include_note: boolean;
  include_summary: boolean;
  include_refs: boolean;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
  access_count: number;
};

export type ShareOptions = {
  includeNote: boolean;
  includeSummary: boolean;
  includeRefs: boolean;
  /** null = never expires */
  expiresInDays: number | null;
};

const COLUMNS =
  "id, idea_id, include_note, include_summary, include_refs, created_at, expires_at, revoked_at, last_accessed_at, access_count";

/** Shares the signed-in owner has created for one idea. */
export function useIdeaShares(ideaId: string | null) {
  return useQuery({
    queryKey: ["idea-shares", ideaId],
    enabled: !!ideaId,
    queryFn: async (): Promise<IdeaShare[]> => {
      const { data, error } = await supabase
        .from("idea_shares")
        .select(COLUMNS)
        .eq("idea_id", ideaId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IdeaShare[];
    },
  });
}

/**
 * Creates a share and returns the raw token exactly once. The token is not
 * persisted anywhere — only its SHA-256 reaches the server — so a link that is
 * lost has to be regenerated rather than looked up.
 */
export function useCreateShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ideaId,
      options,
    }: {
      ideaId: string;
      options: ShareOptions;
    }): Promise<{ share: IdeaShare; token: string }> => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("You need to be signed in to share.");

      const token = generateShareToken();
      const expiresAt =
        options.expiresInDays === null
          ? null
          : new Date(Date.now() + options.expiresInDays * 86_400_000).toISOString();

      const { data, error } = await supabase
        .from("idea_shares")
        .insert({
          user_id: userId,
          idea_id: ideaId,
          token_hash: await hashShareToken(token),
          include_note: options.includeNote,
          include_summary: options.includeSummary,
          include_refs: options.includeRefs,
          expires_at: expiresAt,
        })
        .select(COLUMNS)
        .single();
      if (error) throw error;

      return { share: data as IdeaShare, token };
    },
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: ["idea-shares", vars.ideaId] });
    },
  });
}

/** Revocation is immediate: the resolver refuses any share with revoked_at set. */
export function useRevokeShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; ideaId: string }) => {
      const { error } = await supabase
        .from("idea_shares")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: ["idea-shares", vars.ideaId] });
    },
  });
}
