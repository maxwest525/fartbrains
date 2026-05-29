import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Bell,
  BellOff,
  AlarmClock,
  CalendarIcon,
  Clock,
  Smartphone,
  Mail,
  ArrowRight,
  Check,
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
import { useUpdateIdea } from "@/hooks/useIdeas";
import { openPhoneAlarm } from "@/lib/phoneAlarm";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idea: {
    id: string;
    title: string;
    remind_at: string | null;
    notify_push: boolean;
    notify_email: boolean;
  } | null;
};

/** Build a Date from a date + "HH:mm" string. */
const combine = (date: Date, time: string): Date | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  const d = new Date(date);
  d.setHours(h, mi, 0, 0);
  return d;
};

const padTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Quick chip helper — returns Date at the named relative offset. */
const quickPicks = (): Array<{ label: string; date: Date }> => {
  const now = new Date();
  const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);
  const tomorrow9 = new Date(now);
  tomorrow9.setDate(tomorrow9.getDate() + 1);
  tomorrow9.setHours(9, 0, 0, 0);
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(9, 0, 0, 0);
  return [
    { label: "In 1 hour", date: in1h },
    { label: "Tonight 8 PM", date: tonight },
    { label: "Tomorrow 9 AM", date: tomorrow9 },
    { label: "Next week", date: nextWeek },
  ];
};

/**
 * Reminder creation screen — opens as a bottom sheet on mobile and a
 * floating panel on desktop. Provides:
 *   • quick-pick chips for common times
 *   • shadcn Calendar for date selection
 *   • dedicated time input
 *   • channel toggles (browser push, email)
 *   • a prominent "Open in Clock app" handoff that hands the time to
 *     the OS Clock app for a true OS-level alarm
 */
export const IdeaReminderDialog = ({ open, onOpenChange, idea }: Props) => {
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState<string>("09:00");
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const update = useUpdateIdea();

  useEffect(() => {
    if (!open || !idea) return;
    if (idea.remind_at) {
      const d = new Date(idea.remind_at);
      setDate(d);
      setTime(padTime(d));
    } else {
      const def = new Date();
      def.setHours(def.getHours() + 1, 0, 0, 0);
      setDate(def);
      setTime(padTime(def));
    }
    setPush(idea.notify_push);
    setEmail(idea.notify_email);
  }, [open, idea]);

  const combined = useMemo(
    () => (date ? combine(date, time) : null),
    [date, time],
  );

  const validFuture = combined !== null && combined.getTime() > Date.now() - 60_000;

  if (!idea) return null;

  const applyQuick = (d: Date) => {
    setDate(d);
    setTime(padTime(d));
  };

  const save = async () => {
    if (!combined) return;
    if (
      push &&
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      try {
        await Notification.requestPermission();
      } catch {
        /* noop */
      }
    }
    await update.mutateAsync({
      id: idea.id,
      patch: {
        remind_at: combined.toISOString(),
        notify_push: push,
        notify_email: email,
        reminder_fired_at: null,
      },
    });
    onOpenChange(false);
  };

  const clear = async () => {
    await update.mutateAsync({
      id: idea.id,
      patch: { remind_at: null, reminder_fired_at: null },
    });
    onOpenChange(false);
  };

  const handoff = () => {
    if (!combined) return;
    openPhoneAlarm(combined, idea.title);
  };

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
              New reminder
            </SheetTitle>
            <SheetDescription className="line-clamp-2">
              {idea.title}
            </SheetDescription>
          </SheetHeader>

          {/* Quick picks */}
          <div className="flex flex-wrap gap-2">
            {quickPicks().map((q) => {
              const active =
                combined &&
                Math.abs(combined.getTime() - q.date.getTime()) < 60_000;
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => applyQuick(q.date)}
                  className={cn(
                    "h-9 px-3 rounded-full text-sm font-medium transition-colors border",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-foreground border-transparent hover:bg-secondary/80",
                  )}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          {/* Date + time pickers */}
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
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>
                {format(combined, "EEEE, MMMM d 'at' h:mm a")} ·{" "}
                <span className={cn(!validFuture && "text-destructive")}>
                  {validFuture ? formatReminder(combined.toISOString()) : "in the past"}
                </span>
              </span>
            </div>
          )}

          {/* Phone alarm handoff — prominent */}
          <button
            type="button"
            onClick={handoff}
            disabled={!validFuture}
            className={cn(
              "w-full text-left rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 py-4 flex items-center gap-4 transition-all",
              validFuture
                ? "hover:border-primary/60 hover:from-primary/15 active:scale-[0.99]"
                : "opacity-50 cursor-not-allowed",
            )}
          >
            <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <AlarmClock className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Open in Clock app</p>
              <p className="text-[12px] text-muted-foreground">
                Hand off to your phone's Clock for a real alarm sound.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-primary shrink-0" />
          </button>

          {/* Channels */}
          <div className="rounded-2xl border border-border/60 divide-y divide-border/60 bg-card">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Smartphone className="h-4 w-4" />
              </div>
              <Label htmlFor="push-toggle" className="flex-1 text-sm font-medium">
                Browser push
                <span className="block text-[11px] font-normal text-muted-foreground">
                  In-app alarm + system notification.
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

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {idea.remind_at && (
              <Button
                variant="ghost"
                className="flex-1 h-12 rounded-full text-destructive hover:text-destructive"
                onClick={clear}
                disabled={update.isPending}
              >
                <BellOff className="h-4 w-4 mr-1.5" /> Clear
              </Button>
            )}
            <Button
              className="flex-1 h-12 rounded-full text-base"
              onClick={save}
              disabled={!validFuture || update.isPending || (!push && !email)}
            >
              <Check className="h-4 w-4 mr-1.5" />
              Save reminder
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
