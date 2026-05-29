import { useEffect, useState } from "react";
import { Bell, BellOff, AlarmClock } from "lucide-react";
import { openPhoneAlarm } from "@/lib/phoneAlarm";
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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  toLocalInputValue,
  fromLocalInputValue,
  formatReminder,
} from "@/lib/formatTime";
import { useUpdateIdea } from "@/hooks/useIdeas";

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

/**
 * Per-idea reminder editor. Lets the user pick a time and choose which
 * channels (push / email) the dispatcher should fire when it's due.
 * Asks for browser notification permission on save when push is enabled
 * — purely best-effort.
 */
export const IdeaReminderDialog = ({ open, onOpenChange, idea }: Props) => {
  const [value, setValue] = useState("");
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const update = useUpdateIdea();

  useEffect(() => {
    if (open && idea) {
      setValue(toLocalInputValue(idea.remind_at));
      setPush(idea.notify_push);
      setEmail(idea.notify_email);
    }
  }, [open, idea]);

  if (!idea) return null;

  const submit = async () => {
    const iso = fromLocalInputValue(value);
    if (
      iso &&
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
        remind_at: iso,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Remind me about this idea
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{idea.title}</DialogDescription>
        </DialogHeader>

        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
        />
        {value && (
          <p className="text-[12px] text-muted-foreground -mt-2">
            {formatReminder(fromLocalInputValue(value) ?? new Date().toISOString())}
          </p>
        )}

        <div className="rounded-xl border border-border/60 divide-y divide-border/60">
          <div className="flex items-center justify-between px-3 py-2.5">
            <Label htmlFor="push-toggle" className="text-sm font-medium">
              Browser push
              <span className="block text-[11px] font-normal text-muted-foreground">
                Works when the browser is running.
              </span>
            </Label>
            <Switch id="push-toggle" checked={push} onCheckedChange={setPush} />
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <Label htmlFor="email-toggle" className="text-sm font-medium">
              Email
              <span className="block text-[11px] font-normal text-muted-foreground">
                Sent to your account email.
              </span>
            </Label>
            <Switch id="email-toggle" checked={email} onCheckedChange={setEmail} />
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full h-11 rounded-xl"
          disabled={!value}
          onClick={() => {
            const iso = fromLocalInputValue(value);
            if (!iso) return;
            openPhoneAlarm(new Date(iso), idea.title);
          }}
        >
          <AlarmClock className="h-4 w-4 mr-1.5" />
          Set phone alarm
        </Button>
        <p className="text-[11px] text-muted-foreground -mt-1 text-center">
          Opens your Clock app pre-filled. Tap Save there for a real alarm.
        </p>


        <DialogFooter className="gap-2 sm:gap-0">
          {idea.remind_at && (
            <Button variant="ghost" onClick={clear} disabled={update.isPending}>
              <BellOff className="h-4 w-4 mr-1.5" /> Clear
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!value || update.isPending || (!push && !email)}
          >
            Save reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
