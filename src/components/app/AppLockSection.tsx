import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PasscodeKeypad } from "@/components/auth/PasscodeKeypad";
import { clearPasscode, hasPasscode } from "@/lib/passcode";
import { toast } from "sonner";

/**
 * Opt-in device-level app lock. The passcode is hashed and stored on this
 * device only — it never reaches the server and it is not an account
 * credential. Living in Settings (rather than first run) keeps signup fast.
 */
export const AppLockSection = () => {
  const [enabled, setEnabled] = useState(() => hasPasscode());
  const [setupOpen, setSetupOpen] = useState(false);

  const disable = () => {
    clearPasscode();
    setEnabled(false);
    toast.success("App lock turned off");
  };

  return (
    <div className="mt-5 rounded-2xl bg-card border border-border/60 px-4 py-3 flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {enabled ? <Lock className="h-5 w-5" /> : <LockOpen className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">App lock</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {enabled
            ? "A passcode is required to open Fartbrains on this device."
            : "Optional passcode for this device. Not your account password."}
        </p>
      </div>
      <Button
        variant={enabled ? "outline" : "default"}
        size="sm"
        className="rounded-full shrink-0"
        onClick={() => (enabled ? disable() : setSetupOpen(true))}
      >
        {enabled ? "Turn off" : "Set up"}
      </Button>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set an app lock passcode</DialogTitle>
            <DialogDescription>
              Stored only on this device. If you forget it, sign out and back in
              to clear it.
            </DialogDescription>
          </DialogHeader>
          <PasscodeKeypad
            mode="setup"
            onUnlocked={() => {
              setEnabled(true);
              setSetupOpen(false);
              toast.success("App lock enabled");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
