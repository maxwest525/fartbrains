import { useEffect, useRef } from "react";
import { useFolders } from "./useFolders";
import { toast } from "sonner";
import { alarmBus } from "@/lib/alarmBus";

const FIRED_KEY = "folder-reminders-fired";
const POLL_MS = 30_000; // 30s — cheap and good enough for in-app reminders

/** Loads & persists the set of remind_at ISO strings we've already notified for. */
const loadFired = (): Set<string> => {
  try {
    const raw = localStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};
const saveFired = (s: Set<string>) => {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...s]));
  } catch {
    /* noop */
  }
};

/**
 * Polls the user's folders client-side and fires a browser + in-app
 * notification when a folder's `remind_at` is due. Each (folder.id|remind_at)
 * pair fires at most once per browser (deduped via localStorage), so changing
 * the time resets the dedupe key automatically.
 */
export function useReminderNotifier() {
  const { data: folders = [] } = useFolders();
  const firedRef = useRef<Set<string>>(loadFired());

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      let changed = false;
      for (const f of folders) {
        if (!f.remind_at) continue;
        const due = new Date(f.remind_at).getTime();
        if (Number.isNaN(due) || due > now) continue;
        const key = `${f.id}|${f.remind_at}`;
        if (firedRef.current.has(key)) continue;

        // System notification (best effort)
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("Folder reminder", {
              body: f.name,
              tag: key,
            });
          } catch {
            /* noop */
          }
        }
        // In-app toast as a guaranteed fallback
        toast(`Reminder: ${f.name}`, {
          description: "This folder reminder is due.",
        });

        // Full-screen looping alarm (loud, tap-to-dismiss)
        alarmBus.trigger({
          title: f.name,
          body: "Folder reminder is due.",
        });


        firedRef.current.add(key);
        changed = true;
      }
      if (changed) saveFired(firedRef.current);
    };

    check(); // run immediately
    const id = window.setInterval(check, POLL_MS);
    return () => window.clearInterval(id);
  }, [folders]);
}
