import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Bell,
  AlarmClock,
  CalendarIcon,
  Clock,
  Smartphone,
  Mail,
  ArrowRight,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatReminder } from "@/lib/formatTime";
import { openPhoneAlarm } from "@/lib/phoneAlarm";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import {
  useIdeaReminders,
  useCreateIdeaReminder,
  useDeleteIdeaReminder,
} from "@/hooks/useIdeaReminders";

const AUTO_PROMPT_KEY = "push-auto-prompted-v1";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: {
    id: string;
    title: string;
  } | null;
};

const padTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const combine = (date: Date, time: string): Date | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const d = new Date(date);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
};

/** Quick offsets — add a reminder N units from now. */
const QUICK_OFFSETS: Array<{ label: string; ms: number }> = [
  { label: "In 1 hour", ms: 60 * 60 * 1000 },
  { label: "In 3 hours", ms: 3 * 60 * 60 * 1000 },
  { label: "Tonight 8 PM", ms: -1 }, // handled specially
  { label: "Tomorrow 9 AM", ms: -2 }, // handled specially
  { label: "In 1 day", ms: 24 * 60 * 60 * 1000 },
  { label: "In 2 days", ms: 2 * 24 * 60 * 60 * 1000 },
  { label: "In 3 days", ms: 3 * 24 * 60 * 60 * 1000 },
  { label: "In 1 week", ms: 7 * 24 * 60 * 60 * 1000 },
];

const quickDate = (ms: number): Date => {
  if (ms === -1) {
    const t = new Date();
    t.setHours(20, 0, 0, 0);
    if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
    return t;
  }
  if (ms === -2) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    return t;
  }
  return new Date(Date.now() + ms);
};

export const IdeaReminderDialog = ({ open, onOpenChange, idea }: Props) => {
  const reminders = useIdeaReminders(idea?.id ?? null);
  const create = useCreateIdeaReminder();
  const del = useDeleteIdeaReminder();
  const push_ = usePushSubscription();

  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string>("09:00");
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const def = new Date();
    def.setHours(def.getHours() + 1, 0, 0, 0);
    setDate(def);
    setTime(padTime(def));
    setPush(true);
    setEmail(false);
  }, [open, idea?.id]);

  const combined = useMemo(
    () => (date ? combine(date, time) : null),
    [date, time],
  );
  const validFuture = combined !== null && combined.getTime() > Date.now() - 60_000;

  if (!idea) return null;

  const ensurePushIfNeeded = async () => {
    if (!push) return;
    const alreadyPrompted =
      typeof window !== "undefined" && localStorage.getItem(AUTO_PROMPT_KEY) === "1";
    if (!alreadyPrompted && push_.state === "unsubscribed") {
      localStorage.setItem(AUTO_PROMPT_KEY, "1");
      try {
        await push_.subscribe();
      } catch { /* noop */ }
    } else if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      try { await Notification.requestPermission(); } catch { /* noop */ }
    }
  };

  const addAt = async (when: Date) => {
    if (when.getTime() <= Date.now() - 60_000) {
      return;
    }
    await ensurePushIfNeeded();
    await create.mutateAsync({
      idea_id: idea.id,
      remind_at: when.toISOString(),
      notify_push: push,
      notify_email: email,
    });
  };

  const addCustom = async () => {
    if (!combined || !validFuture) return;
    await addAt(combined);
  };

  const handoff = () => {
    if (!combined) return;
    openPhoneAlarm(combined, idea.title);
  };

  const list = reminders.data ?? [];
  const upcoming = list.filter((r) => !r.fired_at);
  const past = list.filter((r) => r.fired_at);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0 max-h-[92dvh] overflow-y-auto"
      >
        <div className="safe-bottom px-5 pt-5 pb-8 space-y-5">
          <SheetHeader className="text-left space-y-1">
            <SheetTitle className="flex items-center gap-2 text-2xl tracking-tight">
              <Bell className="h-5 w-5 text-primary" />
              Reminders
            </SheetTitle>
            <SheetDescription className="line-clamp-2">
              {idea.title}
            </SheetDescription>
          </SheetHeader>

          {/* Existing reminders */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Scheduled ({upcoming.length})
              </Label>
              {reminders.isLoading && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              )}
            </div>
            {upcoming.length === 0 && !reminders.isLoading && (
              <p className="text-sm text-muted-foreground py-2">
                No reminders yet — add as many as you want below.
              </p>
            )}
            <ul className="space-y-1.5">
              {upcoming.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5"
                >
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {format(new Date(r.remind_at), "EEE, MMM d 'at' h:mm a")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatReminder(r.remind_at)} ·{" "}
                      {[r.notify_push && "push", r.notify_email && "email"]
                        .filter(Boolean)
                        .join(" + ") || "muted"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => del.mutate({ id: r.id, idea_id: idea.id })}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 press"
                    aria-label="Remove reminder"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            {past.length > 0 && (
              <details className="pt-1">
                <summary className="text-[11px] text-muted-foreground cursor-pointer">
                  Already fired ({past.length})
                </summary>
                <ul className="space-y-1 mt-2">
                  {past.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 text-xs text-muted-foreground px-3 py-1.5"
                    >
                      <span className="flex-1">
                        {format(new Date(r.remind_at), "MMM d, h:mm a")}
                      </span>
                      <button
                        type="button"
                        onClick={() => del.mutate({ id: r.id, idea_id: idea.id })}
                        className="hover:text-destructive"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* Add reminder */}
          <section className="space-y-3 pt-2 border-t border-border/60">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Add another
            </Label>

            {/* Quick chips — one tap adds a reminder immediately */}
            <div className="flex flex-wrap gap-2">
              {QUICK_OFFSETS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  disabled={create.isPending}
                  onClick={() => addAt(quickDate(q.ms))}
                  className={cn(
                    "h-9 px-3 rounded-full text-sm font-medium border bg-secondary text-foreground border-transparent hover:bg-secondary/80 transition-colors disabled:opacity-50",
                  )}
                >
                  <Plus className="h-3.5 w-3.5 inline -mt-0.5 mr-1 opacity-70" />
                  {q.label}
                </button>
              ))}
            </div>

            {/* Custom picker */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "h-12 w-full justify-start text-left font-normal rounded-xl bg-secondary/60 border-transparent text-[15px]",
                        !date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="h-4 w-4 mr-2 opacity-70" />
                      {date ? format(date, "EEE, MMM d") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(d) => {
                        if (d) {
                          setDate(d);
                          setDateOpen(false);
                        }
                      }}
                      disabled={(d) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return d < today;
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rem-time" className="text-xs text-muted-foreground">
                  Time
                </Label>
                <div className="relative">
                  <Clock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="rem-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-12 pl-9 rounded-xl bg-secondary/60 border-transparent text-[15px]"
                  />
                </div>
              </div>
            </div>

            {combined && (
              <div className="text-xs text-center text-muted-foreground">
                {format(combined, "EEEE, MMMM d 'at' h:mm a")} ·{" "}
                <span className={cn(!validFuture && "text-destructive")}>
                  {validFuture ? formatReminder(combined.toISOString()) : "in the past"}
                </span>
              </div>
            )}

            {/* Channels — applied to whichever reminder you add next */}
            <div className="rounded-2xl border border-border/60 divide-y divide-border/60 bg-card">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Smartphone className="h-4 w-4" />
                </div>
                <Label htmlFor="push-toggle" className="flex-1 text-sm font-medium">
                  Phone push
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    Sent to every device you've enabled.
                  </span>
                </Label>
                <Switch id="push-toggle" checked={push} onCheckedChange={setPush} />
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Mail className="h-4 w-4" />
                </div>
                <Label htmlFor="email-toggle" className="flex-1 text-sm font-medium">
                  Email
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    Sent to your account email.
                  </span>
                </Label>
                <Switch id="email-toggle" checked={email} onCheckedChange={setEmail} />
              </div>
            </div>

            <Button
              className="w-full h-12 rounded-full text-base"
              onClick={addCustom}
              disabled={!validFuture || create.isPending || (!push && !email)}
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1.5" />
              )}
              Add reminder
            </Button>

            {/* Phone alarm handoff */}
            <button
              type="button"
              onClick={handoff}
              disabled={!validFuture}
              className={cn(
                "w-full text-left rounded-2xl border border-border/60 bg-secondary/40 px-4 py-3 flex items-center gap-3 transition-all",
                validFuture
                  ? "hover:border-primary/60 active:scale-[0.99]"
                  : "opacity-50 cursor-not-allowed",
              )}
            >
              <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <AlarmClock className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Also open in Clock app</p>
                <p className="text-[11px] text-muted-foreground">
                  Hands the time off to your phone's Clock for a real alarm sound.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-primary shrink-0" />
            </button>
          </section>

          <Button
            variant="ghost"
            className="w-full h-11 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
