import { useEffect, useRef } from "react";
import { useFolders } from "./useFolders";
import { useCalendarEvents } from "./useCalendarEvents";
import { toast } from "sonner";
import { alarmBus } from "@/lib/alarmBus";
import {
  nextOccurrence,
  daysBetween,
  ageOnNext,
  LEAD_TIMES_DAYS,
  DAILY_ALARM_HOUR,
} from "@/lib/calendarEvents";

const FIRED_KEY = "folder-reminders-fired";
const CAL_FIRED_KEY = "calendar-alerts-fired";
const POLL_MS = 30_000; // 30s — cheap and good enough for in-app reminders

/** Loads & persists the set of remind_at ISO strings we've already notified for. */
const loadFired = (key: string): Set<string> => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
};
const saveFired = (key: string, s: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify([...s]));
  } catch {
    /* noop */
  }
};

/**
 * Polls the user's folders + calendar events client-side and fires
 * browser + in-app alarms when due.
 *
 * Folder reminders fire at their `remind_at` timestamp (any time).
 * Calendar events fire the daily check at DAILY_ALARM_HOUR for each
 * lead-time in LEAD_TIMES_DAYS (7, 3, 0 days before). Each (event, year,
 * lead) combo fires at most once.
 */
export function useReminderNotifier() {
  const { data: folders = [] } = useFolders();
  const { data: calEvents = [] } = useCalendarEvents();
  const firedRef = useRef<Set<string>>(loadFired(FIRED_KEY));
  const calFiredRef = useRef<Set<string>>(loadFired(CAL_FIRED_KEY));

  useEffect(() => {
    const checkFolders = () => {
      const now = Date.now();
      let changed = false;
      for (const f of folders) {
        if (!f.remind_at) continue;
        const due = new Date(f.remind_at).getTime();
        if (Number.isNaN(due) || due > now) continue;
        const key = `${f.id}|${f.remind_at}`;
        if (firedRef.current.has(key)) continue;

        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("Folder reminder", { body: f.name, tag: key });
          } catch {
            /* noop */
          }
        }
        toast(`Reminder: ${f.name}`, { description: "This folder reminder is due." });
        alarmBus.trigger({ title: f.name, body: "Folder reminder is due." });

        firedRef.current.add(key);
        changed = true;
      }
      if (changed) saveFired(FIRED_KEY, firedRef.current);
    };

    const checkCalendar = () => {
      const now = new Date();
      // Only fire daily reminders once the configured hour has passed.
      if (now.getHours() < DAILY_ALARM_HOUR) return;

      let changed = false;
      for (const ev of calEvents) {
        const next = nextOccurrence(ev, now);
        if (!next) continue;
        const days = daysBetween(now, next);

        for (const lead of LEAD_TIMES_DAYS) {
          if (days !== lead) continue;
          // Dedupe key includes year so it can fire again next year.
          const key = `${ev.id}|${next.getFullYear()}|${lead}`;
          if (calFiredRef.current.has(key)) continue;

          const age = ageOnNext(ev, now);
          const ageSuffix = age != null ? ` · turning ${age}` : "";
          const when =
            lead === 0
              ? "TODAY"
              : `in ${lead} days`;
          const title = `${ev.emoji ?? "📅"} ${ev.name}`;
          const body = lead === 0 ? `It's today!${ageSuffix}` : `Heads up — ${when}${ageSuffix}`;

          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              new Notification(title, { body, tag: key });
            } catch {
              /* noop */
            }
          }
          toast(title, { description: body });
          alarmBus.trigger({ title: ev.name, body });

          calFiredRef.current.add(key);
          changed = true;
        }
      }
      if (changed) saveFired(CAL_FIRED_KEY, calFiredRef.current);
    };

    const tick = () => {
      checkFolders();
      checkCalendar();
    };

    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [folders, calEvents]);
}
