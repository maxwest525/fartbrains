import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeUrl } from "@/lib/normalizeUrl";
import { useMemo } from "react";

export type DuplicateMatch = {
  id: string;
  title: string;
  source_url: string;
};

/**
 * Looks up existing ideas whose source_url normalizes to the same value as `url`.
 * Returns null when the input URL is empty or unparseable.
 */
export function useDuplicateUrl(url: string | null | undefined) {
  const normalized = useMemo(() => (url ? normalizeUrl(url) : null), [url]);

  return useQuery({
    queryKey: ["duplicate-url", normalized],
    enabled: !!normalized,
    queryFn: async (): Promise<DuplicateMatch | null> => {
      if (!normalized) return null;
      // Pull every idea with a source_url; normalize client-side. The set is
      // small (per-user via RLS) so this stays cheap and avoids fragile SQL.
      const { data, error } = await supabase
        .from("ideas")
        .select("id, title, source_url")
        .not("source_url", "is", null);
      if (error) throw error;
      const match = (data ?? []).find(
        (row) => row.source_url && normalizeUrl(row.source_url) === normalized
      );
      return match ? (match as DuplicateMatch) : null;
    },
    staleTime: 30_000,
  });
}
