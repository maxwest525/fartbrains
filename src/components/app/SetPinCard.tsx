import { useState } from "react";
import { KeyRound, Loader2, Delete, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PIN_LENGTH = 4;
const pinToPassword = (pin: string) => `${pin}-fbpin`;

/**
 * Settings card for setting or updating the 4-digit PIN on the signed-in account.
 * Moved out of the AuthScreen so the auth keypad stays focused on sign-in.
 */
export const SetPinCard = () => {
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);

  const press = (d: string) => {
    if (saving) return;
    setPin((p) => (p.length >= PIN_LENGTH ? p : p + d));
  };
  const back = () => setPin((p) => p.slice(0, -1));

  const save = async () => {
    if (pin.length !== PIN_LENGTH) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pinToPassword(pin) });
      if (error) throw error;
      toast.success("PIN saved. Use it next sign in.");
      setPin("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save PIN");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-5 rounded-2xl bg-card border border-border/60 px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <KeyRound className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Sign-in PIN</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Set a 4-digit PIN so you can sign in with the keypad.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-3 w-3 rounded-full border transition-all",
                i < pin.length ? "bg-foreground border-foreground scale-110" : "border-foreground/30",
              )}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[1,2,3,4,5,6,7,8,9].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => press(String(n))}
              disabled={saving}
              className="h-11 w-11 rounded-full bg-secondary hover:bg-secondary/80 active:scale-95 text-[18px] font-light transition disabled:opacity-40"
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin("")}
            disabled={saving || !pin}
            className="h-11 w-11 rounded-full text-[11px] text-muted-foreground hover:bg-secondary/60 active:scale-95 transition disabled:opacity-30"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => press("0")}
            disabled={saving}
            className="h-11 w-11 rounded-full bg-secondary hover:bg-secondary/80 active:scale-95 text-[18px] font-light transition disabled:opacity-40"
          >
            0
          </button>
          <button
            type="button"
            onClick={back}
            disabled={saving || !pin}
            aria-label="Backspace"
            className="h-11 w-11 rounded-full flex items-center justify-center hover:bg-secondary/60 active:scale-95 transition disabled:opacity-30"
          >
            <Delete className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || pin.length !== PIN_LENGTH}
          className="w-full h-10 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.99] transition"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save PIN
        </button>
      </div>
    </div>
  );
};
