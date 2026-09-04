import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type DraftField = "composer" | "jot";

/**
 * A draft text field that lives on the account (public.user_drafts) so unsaved
 * composer/jot text follows the user between phone and desktop.
 *
 * localStorage stays the instant-restore cache: the local value renders first,
 * the account value wins once it arrives (when it is newer/non-empty), and every
 * change is written back with a short debounce.
 */
export function useSyncedDraft(field: DraftField, localKey: string) {
  const [value, setValue] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const timer = useRef<number | null>(null);

  // 1) Instant local restore, then reconcile with the account copy.
  useEffect(() => {
    let cancelled = false;
    let local = "";
    try {
      local = localStorage.getItem(localKey) ?? "";
    } catch {
      /* ignore */
    }
    setValue(local);

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        if (!cancelled) setHydrated(true);
        return;
      }
      const { data } = await supabase
        .from("user_drafts")
        .select("composer, jot")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      const remote = (data?.[field] ?? "").trim();
      if (remote && remote !== local.trim()) {
        setValue(data?.[field] ?? "");
        try {
          localStorage.setItem(localKey, data?.[field] ?? "");
        } catch {
          /* ignore */
        }
      }
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [field, localKey]);

  // 2) Persist locally immediately, to the account with a debounce.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(localKey, value);
    } catch {
      /* ignore */
    }
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId) return;
        const row =
          field === "composer"
            ? { user_id: userId, composer: value }
            : { user_id: userId, jot: value };
        await supabase.from("user_drafts").upsert(row, { onConflict: "user_id" });
      })();
    }, 900);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [field, hydrated, localKey, value]);

  const clear = useCallback(() => setValue(""), []);

  return { value, setValue, clear, hydrated };
}
