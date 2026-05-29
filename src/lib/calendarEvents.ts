// Calendar event helpers — resolve floating holidays, compute the next
// occurrence of a recurring (yearly) event, and figure out lead-time alerts.

export type CalendarEventType =
  | "birthday"
  | "holiday"
  | "floating_holiday"
  | "custom";

export type FloatingKey = "mothers_day" | "fathers_day" | "thanksgiving";

export type CalendarEvent = {
  id: string;
  user_id: string;
  name: string;
  event_type: CalendarEventType;
  month: number | null;
  day: number | null;
  floating_key: FloatingKey | null;
  birth_year: number | null;
  emoji: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Lead times (in days) that should fire an alarm before each event. */
export const LEAD_TIMES_DAYS = [7, 3, 0] as const;

/** Hour of day (local) the daily reminder check fires at. */
export const DAILY_ALARM_HOUR = 11;

/** Return the date of the Nth weekday in a given month/year. weekday: 0=Sun..6=Sat. */
function nthWeekdayOfMonth(year: number, month1: number, weekday: number, n: number): Date {
  const d = new Date(year, month1 - 1, 1);
  const offset = (weekday - d.getDay() + 7) % 7;
  d.setDate(1 + offset + (n - 1) * 7);
  return d;
}

/** Resolve a floating holiday for a given year. */
export function resolveFloating(key: FloatingKey, year: number): Date {
  switch (key) {
    case "mothers_day":
      return nthWeekdayOfMonth(year, 5, 0, 2); // 2nd Sunday in May
    case "fathers_day":
      return nthWeekdayOfMonth(year, 6, 0, 3); // 3rd Sunday in June
    case "thanksgiving":
      return nthWeekdayOfMonth(year, 11, 4, 4); // 4th Thursday in November
  }
}

/** Return the date this event falls on in the given year. */
export function dateInYear(ev: Pick<CalendarEvent, "month" | "day" | "floating_key">, year: number): Date | null {
  if (ev.floating_key) return resolveFloating(ev.floating_key, year);
  if (ev.month != null && ev.day != null) return new Date(year, ev.month - 1, ev.day);
  return null;
}

/** Return the next future occurrence of this event from `from` (default: now). */
export function nextOccurrence(ev: Pick<CalendarEvent, "month" | "day" | "floating_key">, from: Date = new Date()): Date | null {
  const y = from.getFullYear();
  const today = new Date(from);
  today.setHours(0, 0, 0, 0);

  const thisYear = dateInYear(ev, y);
  if (thisYear && thisYear >= today) return thisYear;
  return dateInYear(ev, y + 1);
}

/** Whole days between two dates (ignoring time-of-day). */
export function daysBetween(a: Date, b: Date): number {
  const da = new Date(a);
  da.setHours(0, 0, 0, 0);
  const db = new Date(b);
  db.setHours(0, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/** Compute the age someone is turning, given a birth year. */
export function ageOnNext(ev: Pick<CalendarEvent, "birth_year" | "month" | "day" | "floating_key">, from: Date = new Date()): number | null {
  if (!ev.birth_year) return null;
  const next = nextOccurrence(ev, from);
  if (!next) return null;
  return next.getFullYear() - ev.birth_year;
}

/** Human label like "today", "tomorrow", "in 3 days", "Jun 21". */
export function whenLabel(date: Date, from: Date = new Date()): string {
  const days = daysBetween(from, date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days >= 7 && days < 30) return `In ${Math.round(days / 7)}w`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
