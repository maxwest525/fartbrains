import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { UserInstructions } from "@/hooks/useUserInstructions";

export type InstructionSuggestions = UserInstructions;

/**
 * Asks the backend to draft personal instructions from patterns in the user's
 * own vault. Purely a suggestion source — nothing is saved until the user
 * accepts it on the instructions page.
 */
export const useInstructionSuggestions = () => {
  const [suggestions, setSuggestions] = useState<InstructionSuggestions | null>(null);
  const [ideaCount, setIdeaCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (existing: UserInstructions) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("suggest-instructions", {
        body: { existing },
      });
      if (fnError) throw fnError;
      const next = (data as { suggestions?: InstructionSuggestions; ideaCount?: number }) ?? {};
      setSuggestions(next.suggestions ?? null);
      setIdeaCount(typeof next.ideaCount === "number" ? next.ideaCount : null);
      return next.suggestions ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not draft suggestions");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => setSuggestions(null), []);

  return { suggestions, ideaCount, loading, error, generate, clear };
};
