import { LogOut, Mail, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

/**
 * Mobile Settings sheet — slides up from the bottom.
 * Houses account info and the sign-out action so the tab bar can keep
 * its clean four-tab iOS layout.
 */
export const SettingsSheet = ({ open, onOpenChange }: Props) => {
  const { user, signOut } = useAuth();

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
