import { LogOut, Mail, Sparkles, Bell, BellOff, Loader2, ShieldCheck, ChevronRight, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Send, Palette, UserCircle2, BrainCircuit } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeToggle, useTheme } from "@/hooks/useTheme";

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
  const { theme } = useTheme();
  const [testing, setTesting] = useState(false);

  const sendTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-push");
      if (error) throw error;
      if (data?.sent > 0) {
        toast.success(
          data.sent === 1
            ? "Test sent — check your notifications."
            : `Test sent to ${data.sent} devices.`,
        );
      } else {
        toast.error(data?.reason ?? "No devices got the test push.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send test push");
    } finally {
      setTesting(false);
    }
  };


  const isiOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari only
      window.navigator.standalone === true);

  // Map current push state → status badge + step-by-step fix instructions.
  const statusMeta = (() => {
    switch (push.state) {
      case "loading":
        return {
          label: "Checking…",
          tone: "muted" as const,
          Icon: Loader2,
          spin: true,
          steps: null,
        };
      case "subscribed":
        return {
          label: "Enabled on this device",
          tone: "ok" as const,
          Icon: CheckCircle2,
          steps: [
            "Reminders will fire here even when the tab is closed or your phone is locked.",
            "Enable on each browser/device you want alerts on.",
          ],
        };
      case "unsubscribed":
        return {
          label: "Disabled",
          tone: "warn" as const,
          Icon: BellOff,
          steps: [
            "Tap Enable below.",
            "Approve the browser permission prompt that appears.",
            "Keep this site bookmarked / installed so the device stays subscribed.",
          ],
        };
      case "denied":
        return {
          label: "Blocked by browser",
          tone: "error" as const,
          Icon: XCircle,
          steps: isiOS
            ? [
                "Open iOS Settings → Safari → Advanced → Website Data and remove this site, or:",
                "Tap the AA / share icon in the address bar → Website Settings → set Notifications to Allow.",
                "Return here and tap Enable.",
              ]
            : [
                "Tap the lock / tune icon in your browser's address bar.",
                "Find Notifications and switch it from Block to Allow.",
                "Reload the page, then tap Enable.",
              ],
        };
      case "unsupported":
        return {
          label: "Not supported in this browser",
          tone: "error" as const,
          Icon: AlertTriangle,
          steps: isiOS && !isStandalone
            ? [
                "iOS only delivers web push to installed apps.",
                "Tap the Share icon in Safari → Add to Home Screen.",
                "Open the app from your Home Screen, then come back to Settings and tap Enable.",
              ]
            : [
                "Use Chrome, Edge, Firefox, or Safari (latest version) on this device.",
                "On iPhone/iPad, install this site to your Home Screen first.",
              ],
        };
    }
  })();

  const toneClasses: Record<string, string> = {
    ok: "bg-[hsl(140_70%_45%/0.12)] text-[hsl(140_70%_35%)] border-[hsl(140_70%_45%/0.25)]",
    warn: "bg-accent/15 text-accent border-accent/30",
    error: "bg-destructive/10 text-destructive border-destructive/25",
    muted: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[90dvh] flex flex-col">
        <div className="safe-bottom px-5 pt-5 pb-8 overflow-y-auto flex-1 min-h-0">

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
            <Link
              to="/profile"
              onClick={() => onOpenChange(false)}
              className="w-full flex items-center gap-3 px-4 py-3 press"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">Profile</p>
                <p className="text-xs text-muted-foreground truncate">Edit your display name</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/settings/instructions"
              onClick={() => onOpenChange(false)}
              className="w-full flex items-center gap-3 px-4 py-3 press"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium">Personal instructions</p>
                <p className="text-xs text-muted-foreground truncate">
                  Your rules for capturing, summarizing, tagging, organizing
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
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

          {/* Appearance — light/dark toggle */}
          <div className="mt-5 rounded-2xl bg-card border border-border/60 px-4 py-3 flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#4285F4 0%,#9B72CB 55%,#D96570 100%)" }}
            >
              <Palette className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Appearance</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {theme === "dark" ? "Dark mode active" : "Light mode active"}
              </p>
            </div>
            <ThemeToggle />
          </div>



          {/* Notifications block — explicit status + fix steps */}
          <div className="mt-5 rounded-2xl bg-card border border-border/60 overflow-hidden">
            <div className="px-4 pt-4 pb-3 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-accent/15 text-accent flex items-center justify-center shrink-0">
                {push.state === "subscribed" ? (
                  <Bell className="h-5 w-5" />
                ) : (
                  <BellOff className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Push notifications</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Reminders that fire on your phone with the tab closed.
                </p>
                <div
                  className={`mt-2 inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full border text-[12px] font-medium ${toneClasses[statusMeta.tone]}`}
                >
                  <statusMeta.Icon
                    className={`h-3.5 w-3.5 ${statusMeta.spin ? "animate-spin" : ""}`}
                  />
                  {statusMeta.label}
                </div>
              </div>
              {push.state === "subscribed" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full shrink-0"
                  onClick={push.unsubscribe}
                  disabled={push.busy}
                >
                  {push.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disable"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="rounded-full shrink-0"
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

            {statusMeta.steps && statusMeta.tone !== "ok" && (
              <div className="border-t border-border/60 bg-secondary/40 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    How to fix
                  </p>
                </div>
                <ol className="space-y-1 text-[12.5px] text-foreground/85 list-decimal pl-4 leading-snug">
                  {statusMeta.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            )}

            {statusMeta.steps && statusMeta.tone === "ok" && (
              <div className="border-t border-border/60 bg-secondary/30 px-4 py-3">
                <ul className="space-y-1 text-[12.5px] text-muted-foreground leading-snug">
                  {statusMeta.steps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(140_70%_45%)] shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {push.state === "subscribed" && (
              <button
                type="button"
                onClick={sendTest}
                disabled={testing}
                className="w-full border-t border-border/60 px-4 py-3 flex items-center gap-3 press text-left disabled:opacity-60"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Send test notification</p>
                  <p className="text-[11px] text-muted-foreground">
                    Fires a push to every device you've enabled.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
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
