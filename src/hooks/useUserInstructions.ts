import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type UserInstructions = {
  general: string;
  capture: string;
  summarize: string;
  tagging: string;
  organizing: string;
};

export const emptyUserInstructions: UserInstructions = {
  general: "",
  capture: "",
  summarize: "",
  tagging: "",
  organizing: "",
};

/** Loads/saves the user's personal second-brain instructions. */
export function useUserInstructions() {
  const { user } = useAuth();
  const [instructions, setInstructions] = useState<UserInstructions>(emptyUserInstructions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: err } = await supabase
        .from("user_instructions")
        .select("general, capture, summarize, tagging, organizing")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (err) setError(err.message);
      if (data) {
        setInstructions({
          general: data.general ?? "",
          capture: data.capture ?? "",
          summarize: data.summarize ?? "",
          tagging: data.tagging ?? "",
          organizing: data.organizing ?? "",
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const save = useCallback(
    async (next: UserInstructions): Promise<boolean> => {
      if (!user) return false;
      setSaving(true);
      setError(null);
      const { error: err } = await supabase
        .from("user_instructions")
        .upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
      setSaving(false);
      if (err) {
        setError(err.message);
        return false;
      }
      setInstructions(next);
      return true;
    },
    [user],
  );

  return { instructions, setInstructions, loading, saving, error, save };
}
