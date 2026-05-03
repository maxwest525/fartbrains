import { LogOut, Mail, Sparkles, Bell, BellOff, Loader2, ShieldCheck, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePushSubscription } from "@/hooks/usePushSubscription";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/**
 * Mobile Settings sheet — slides up from the bottom.
 * Houses account info, push notification enrollment, and the sign-out
 * action so the tab bar can keep its clean four-tab iOS layout.
 */
export const SettingsSheet = ({ open, onOpenChange }: Props) => {
  const { user, signOut } = useAuth();
  const push = usePushSubscription();

  const pushLabel = (() => {
    switch (push.state) {
      case "loading":
        return "Checking…";
      case "unsupported":
        return "Not supported in this browser";
      case "denied":
        return "Blocked — enable in browser settings";
      case "subscribed":
        return "On for this device";
      case "unsubscribed":
        return "Off — enable to get reminders";
    }
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[85dvh]">
        <div className="safe-bottom px-5 pt-5 pb-8">
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="text-2xl tracking-tight">Settings</SheetTitle>
            <SheetDescription className="sr-only">
              Account info and app preferences.
            </SheetDescription>
          </SheetHeader>

          {/* Account block */}
          <div className="rounded-2xl bg-card border border-border/60 divide-y divide-border/60">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Mail className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Signed in as</p>
                <p className="text-sm font-medium truncate">{user?.email ?? "—"}</p>
              </div>
            </div>
            <button
              onClick={() => {
                onOpenChange(false);
                signOut();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-destructive press"
            >
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <LogOut className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">Sign out</span>
            </button>
          </div>

          {/* Notifications block */}
          <div className="mt-5 rounded-2xl bg-card border border-border/60 px-4 py-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent/15 text-accent flex items-center justify-center">
              {push.state === "subscribed" ? (
                <Bell className="h-5 w-5" />
              ) : (
                <BellOff className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Push notifications</p>
              <p className="text-xs text-muted-foreground truncate">{pushLabel}</p>
            </div>
            {push.state === "subscribed" ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={push.unsubscribe}
                disabled={push.busy}
              >
                {push.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disable"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="rounded-full"
                onClick={push.subscribe}
                disabled={
                  push.busy ||
                  push.state === "loading" ||
                  push.state === "unsupported" ||
                  push.state === "denied"
                }
              >
                {push.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enable"}
              </Button>
            )}
          </div>

          {/* Rules & references block */}
          <div className="mt-5 rounded-2xl bg-card border border-border/60 divide-y divide-border/60 overflow-hidden">
            <Link
              to="/settings/prompt-rules"
              onClick={() => onOpenChange(false)}
              className="w-full flex items-center gap-3 px-4 py-3 press"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">Prompt rules</p>
                <p className="text-xs text-muted-foreground truncate">
                  Safety checks the optimizer must pass
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>

          {/* About block */}
          <div className="mt-5 rounded-2xl bg-card border border-border/60 px-4 py-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent/15 text-accent flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Idea Vault</p>
              <p className="text-xs text-muted-foreground">More preferences coming soon.</p>
            </div>
          </div>

          <Button
            variant="ghost"
            className="w-full mt-5 h-11 rounded-full text-primary"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
