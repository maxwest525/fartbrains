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
import { Button } from "@/components/ui/button";
import { useSetFolderReminder } from "@/hooks/useFolders";
import {
  toLocalInputValue,
  fromLocalInputValue,
  formatReminder,
} from "@/lib/formatTime";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: { id: string; name: string; remind_at: string | null } | null;
};

/**
 * Lets the user set / change / clear a reminder time on a folder.
 * Asks for browser notification permission on save so the in-app poller
 * can fire a system notification when the time hits.
 */
export const FolderReminderDialog = ({ open, onOpenChange, folder }: Props) => {
  const [value, setValue] = useState("");
  const setReminder = useSetFolderReminder();

  useEffect(() => {
    if (open && folder) setValue(toLocalInputValue(folder.remind_at));
  }, [open, folder]);

  if (!folder) return null;

  const submit = async () => {
    const iso = fromLocalInputValue(value);
    // Best-effort permission ask; ignore failures (user denial is fine).
    if (iso && typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* noop */
      }
    }
    await setReminder.mutateAsync({ id: folder.id, remindAt: iso });
    onOpenChange(false);
  };

  const clear = async () => {
    await setReminder.mutateAsync({ id: folder.id, remindAt: null });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Remind me about "{folder.name}"
          </DialogTitle>
          <DialogDescription>
            Pick a date and time. We'll send a notification when it's due (browser must be open).
          </DialogDescription>
        </DialogHeader>
        <Input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-12 rounded-xl bg-secondary/60 border-transparent text-[15px]"
        />
        {value && (
          <p className="text-[12px] text-muted-foreground">
            {formatReminder(fromLocalInputValue(value) ?? new Date().toISOString())}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 rounded-xl"
          disabled={!value}
          onClick={() => {
            const iso = fromLocalInputValue(value);
            if (!iso) return;
            openPhoneAlarm(new Date(iso), folder.name);
          }}
        >
          <AlarmClock className="h-4 w-4 mr-1.5" />
          Set phone alarm
        </Button>
        <p className="text-[11px] text-muted-foreground -mt-1 text-center">
          Opens your Clock app pre-filled. Tap Save there for a real alarm.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          {folder.remind_at && (
            <Button variant="ghost" onClick={clear} disabled={setReminder.isPending}>
              <BellOff className="h-4 w-4 mr-1.5" /> Clear
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!value || setReminder.isPending}>
            Save reminder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
