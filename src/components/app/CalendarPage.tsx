import { useMemo, useState } from "react";
import { Plus, Cake, Gift, ChevronLeft, CalendarDays, Pin } from "lucide-react";

const EventIcon = ({ type, className }: { type: string; className?: string }) => {
  if (type === "birthday") return <Cake className={className} />;
  if (type === "floating_holiday") return <CalendarDays className={className} />;
  if (type === "custom") return <Pin className={className} />;
  return <Gift className={className} />;
};
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import {
  dateInYear,
  nextOccurrence,
  daysBetween,
  whenLabel,
  ageOnNext,
  type CalendarEvent,
} from "@/lib/calendarEvents";
import { CalendarEventDialog } from "./CalendarEventDialog";

type Props = {
  /** Mobile back handler (returns to previous tab). */
  onBack?: () => void;
};

/**
 * Calendar page — month grid with event dots + an upcoming list.
 * Birthdays and holidays repeat yearly. Mother's/Father's day are
 * computed dynamically from their floating rule.
 */
export const CalendarPage = ({ onBack }: Props) => {
  const { data: events = [] } = useCalendarEvents();
  const [month, setMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();

  // All event-day Dates that fall in the visible month (and adjacent for grid edges).
  const eventDaysThisMonth = useMemo(() => {
    const result = new Map<string, CalendarEvent[]>();
    const y = month.getFullYear();
    for (const ev of events) {
      // Compute both this year and next year — handles December rolling over.
      for (const yr of [y - 1, y, y + 1]) {
        const d = dateInYear(ev, yr);
        if (!d) continue;
        const key = d.toDateString();
        const arr = result.get(key) ?? [];
        arr.push(ev);
        result.set(key, arr);
      }
    }
    return result;
  }, [events, month]);

  const eventDates = useMemo(
    () => Array.from(eventDaysThisMonth.keys()).map((k) => new Date(k)),
    [eventDaysThisMonth],
  );

  const selectedEvents = useMemo(() => {
    if (!selected) return [];
    return eventDaysThisMonth.get(selected.toDateString()) ?? [];
  }, [selected, eventDaysThisMonth]);

  // Upcoming list — next 12 months, sorted by next occurrence.
  const upcoming = useMemo(() => {
    const now = new Date();
    return events
      .map((ev) => {
        const next = nextOccurrence(ev, now);
        return next ? { ev, next, days: daysBetween(now, next) } : null;
      })
      .filter((x): x is { ev: CalendarEvent; next: Date; days: number } => !!x)
      .sort((a, b) => a.next.getTime() - b.next.getTime())
      .slice(0, 12);
  }, [events]);

  const openCreate = (date?: Date) => {
    setEditing(null);
    setDefaultDate(date);
    setDialogOpen(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditing(ev);
    setDefaultDate(undefined);
    setDialogOpen(true);
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-transparent overflow-y-auto scroll-momentum pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-6">
      {/* Header */}
      <div className="safe-top sticky top-0 z-10 bg-transparent backdrop-blur-xl">
        <div className="px-3 sm:px-5 py-3 flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden h-9 w-9 -ml-1 flex items-center justify-center text-primary"
              aria-label="Back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight flex-1">Calendar</h1>
          <Button size="sm" onClick={() => openCreate(selected)} className="rounded-full h-9">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {/* Month grid */}
      <div className="px-3 sm:px-6 pt-3">
        <div className="rounded-3xl bg-white/15 backdrop-blur-2xl border border-white/25 p-3 sm:p-4 mx-auto w-fit max-w-full shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={setSelected}
            month={month}
            onMonthChange={setMonth}
            modifiers={{ hasEvent: eventDates }}
            modifiersClassNames={{
              hasEvent:
                "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
            }}
            className={cn("p-2 pointer-events-auto")}
          />
        </div>
      </div>



      {/* Selected day's events */}
      {selected && selectedEvents.length > 0 && (
        <div className="px-3 sm:px-6 pt-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            {selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <div className="rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/20 divide-y divide-white/5 overflow-hidden shadow-[0_12px_32px_-18px_rgba(0,0,0,0.6)]">
            {selectedEvents.map((ev) => (
              <EventRow key={ev.id} ev={ev} onClick={() => openEdit(ev)} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="px-3 sm:px-6 pt-5 pb-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Upcoming</p>
        {upcoming.length === 0 ? (
          <div className="rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/20 p-6 text-center shadow-[0_12px_32px_-18px_rgba(0,0,0,0.6)]">
            <p className="text-sm text-muted-foreground mb-3">No events yet.</p>
            <Button size="sm" onClick={() => openCreate()} className="rounded-full">
              <Plus className="h-4 w-4 mr-1" /> Add your first
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/20 divide-y divide-white/5 overflow-hidden shadow-[0_12px_32px_-18px_rgba(0,0,0,0.6)]">
            {upcoming.map(({ ev, next, days }) => (
              <button
                key={ev.id}
                onClick={() => openEdit(ev)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left press hover:bg-white/[0.04]"
              >
                <div className="h-11 w-11 flex items-center justify-center shrink-0">
                  <EventIcon type={ev.event_type} className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate">
                    {ev.name}
                    {ev.event_type === "birthday" && ageOnNext(ev) != null && (
                      <span className="text-muted-foreground font-normal"> · turns {ageOnNext(ev)}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {next.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </p>
                </div>
                <div className={cn(
                  "text-xs font-semibold tabular-nums shrink-0",
                  days === 0
                    ? "text-destructive"
                    : days <= 7
                      ? "text-primary"
                      : "text-muted-foreground"
                )}>
                  {whenLabel(next)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <CalendarEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editing}
        defaultDate={defaultDate}
      />
    </div>
  );
};

const EventRow = ({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) => (
  <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3 text-left press hover:bg-white/[0.04]">
    <div className="h-10 w-10 flex items-center justify-center shrink-0">
      <EventIcon type={ev.event_type} className="h-6 w-6 text-primary" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[15px] font-medium truncate flex items-center gap-1.5">
        {ev.event_type === "birthday" ? <Cake className="h-3.5 w-3.5 text-muted-foreground" /> : <Gift className="h-3.5 w-3.5 text-muted-foreground" />}
        {ev.name}
      </p>
      {ev.event_type === "birthday" && ageOnNext(ev) != null && (
        <p className="text-xs text-muted-foreground">Turns {ageOnNext(ev)}</p>
      )}
    </div>
  </button>
);
