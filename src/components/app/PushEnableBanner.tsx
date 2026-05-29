import { useState } from "react";
import { Bell, X, Loader2, Check } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "push-banner-dismissed-v1";

/**
 * Home-screen banner that nudges the user to enable phone push alerts.
 * Hides itself once the device is subscribed, unsupported, denied, or
 * the user has explicitly dismissed it.
 */
export const PushEnableBanner = () => {
  const { state, busy, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1",
  );

  if (dismissed) return null;
  if (state === "loading" || state === "subscribed" || state === "unsupported" || state === "denied") {
    return null;
  }

  const close = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className={cn(
        "relative rounded-2xl overflow-hidden p-4 pr-3",
        "bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground",
        "shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.55)]",
      )}
    >
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />
      <div className="relative flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Bell className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] leading-tight">Enable phone alerts</p>
          <p className="text-[12.5px] text-primary-foreground/85 mt-0.5 leading-snug">
            Get reminded even when this tab is closed or your phone is locked.
          </p>
          <button
            type="button"
            onClick={subscribe}
            disabled={busy}
            className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-primary text-[13px] font-semibold press disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enabling…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" /> Turn on alerts
              </>
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Dismiss"
          className="h-8 w-8 -mt-1 -mr-1 rounded-full flex items-center justify-center text-primary-foreground/80 hover:bg-white/10 press shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
