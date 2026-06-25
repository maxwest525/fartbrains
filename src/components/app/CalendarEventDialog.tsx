import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Cake, Gift, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
} from "@/hooks/useCalendarEvents";
import type { CalendarEvent, CalendarEventType, FloatingKey } from "@/lib/calendarEvents";
import { EventGiftsSection } from "./EventGiftsSection";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Existing event to edit, or null for create. */
  event: CalendarEvent | null;
  /** Default date when creating from a calendar day. */
  defaultDate?: Date;
};

const EMOJI_BY_TYPE: Record<CalendarEventType, string> = {
  birthday: "🎂",
  holiday: "🎉",
  floating_holiday: "🎉",
  custom: "📌",
};

export const CalendarEventDialog = ({ open, onOpenChange, event, defaultDate }: Props) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<CalendarEventType>("birthday");
  const [date, setDate] = useState<Date | undefined>();
  const [birthYear, setBirthYear] = useState<string>("");
  const [emoji, setEmoji] = useState<string>("🎂");
  const [floatingKey, setFloatingKey] = useState<FloatingKey | "">("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const create = useCreateCalendarEvent();
  const update = useUpdateCalendarEvent();
  const del = useDeleteCalendarEvent();

  useEffect(() => {
    if (!open) return;
    if (event) {
      setName(event.name);
      setType(event.event_type);
      setFloatingKey(event.floating_key ?? "");
      if (event.month && event.day) {
        const y = event.birth_year ?? new Date().getFullYear();
        setDate(new Date(y, event.month - 1, event.day));
      } else {
        setDate(undefined);
      }
      setBirthYear(event.birth_year?.toString() ?? "");
      setEmoji(event.emoji ?? EMOJI_BY_TYPE[event.event_type]);
    } else {
      setName("");
      setType("birthday");
      setFloatingKey("");
      setDate(defaultDate ?? new Date());
      setBirthYear("");
      setEmoji("🎂");
    }
  }, [open, event, defaultDate]);

  const isFloating = type === "floating_holiday";
  const valid = useMemo(() => {
    if (!name.trim()) return false;
    if (isFloating) return !!floatingKey;
    return !!date;
  }, [name, isFloating, floatingKey, date]);

  const submit = async () => {
    if (!valid) return;
    const payload = {
      name: name.trim(),
      event_type: type,
      month: isFloating ? null : (date!.getMonth() + 1),
      day: isFloating ? null : date!.getDate(),
      floating_key: isFloating ? (floatingKey as FloatingKey) : null,
      birth_year: birthYear ? parseInt(birthYear, 10) : null,
      emoji: emoji || EMOJI_BY_TYPE[type],
      notes: null,
    };
    if (event) {
      await update.mutateAsync({ id: event.id, patch: payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  const remove = async () => {
    if (!event) return;
    if (!confirm(`Delete "${event.name}"?`)) return;
    await del.mutateAsync(event.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "birthday" ? <Cake className="h-5 w-5 text-primary" /> : <Gift className="h-5 w-5 text-primary" />}
            {event ? "Edit event" : "Add event"}
          </DialogTitle>
          <DialogDescription>Birthdays and holidays repeat every year.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mom's birthday"
              className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CalendarEventType)}>
              <SelectTrigger className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="birthday">Birthday</SelectItem>
                <SelectItem value="holiday">Holiday (fixed date)</SelectItem>
                <SelectItem value="floating_holiday">Floating holiday</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isFloating ? (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Which holiday?</Label>
              <Select value={floatingKey} onValueChange={(v) => setFloatingKey(v as FloatingKey)}>
                <SelectTrigger className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mothers_day">Mother's Day (2nd Sun May)</SelectItem>
                  <SelectItem value="fathers_day">Father's Day (3rd Sun Jun)</SelectItem>
                  <SelectItem value="thanksgiving">Thanksgiving (4th Thu Nov)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "h-12 w-full justify-start text-left font-normal rounded-xl bg-secondary/60 border-transparent text-[15px]",
                      !date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 mr-2 opacity-70" />
                    {date ? format(date, "MMMM d") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      if (d) {
                        setDate(d);
                        setPickerOpen(false);
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {type === "birthday" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Birth year <span className="text-muted-foreground/70">(optional, shows age)</span>
              </Label>
              <Input
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1990"
                className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
              />
            </div>
          )}

          {event && <EventGiftsSection eventId={event.id} />}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {event && (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || create.isPending || update.isPending}>
            {event ? "Save" : "Add event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
