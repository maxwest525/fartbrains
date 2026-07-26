import { useCallback, useEffect, useState } from "react";
import { Delete, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PASSCODE_LENGTH,
  hasPasscode,
  setPasscode,
  verifyPasscode,
  lockoutRemainingMs,
  clearPasscode,
} from "@/lib/passcode";

type Props = {
  onUnlocked: () => void;
  /** Force setup or unlock UI. Defaults to inferring from `hasPasscode()`. */
  mode?: "setup" | "unlock";
};

/**
 * Apple-style 4-digit passcode.
 *
 * setup: prompts to create a passcode (enter twice).
 * unlock: prompts to enter the existing passcode.
 * Wrong attempt: dots shake + buzz; after 5 fails locks for 30s.
 */
export const PasscodeKeypad = ({ onUnlocked, mode }: Props) => {
  const setupMode = mode ? mode === "setup" : !hasPasscode();
  const [phase, setPhase] = useState<"enter" | "confirm">("enter");

  const [firstCode, setFirstCode] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [lockoutLeft, setLockoutLeft] = useState(0);

  // Tick the lockout countdown.
  useEffect(() => {
    const id = setInterval(() => setLockoutLeft(lockoutRemainingMs()), 500);
    setLockoutLeft(lockoutRemainingMs());
    return () => clearInterval(id);
  }, []);

  const failShake = useCallback((msg: string) => {
    setError(msg);
    setShake(true);
    if ("vibrate" in navigator) navigator.vibrate?.(120);
    setTimeout(() => {
      setCode("");
      setShake(false);
    }, 350);
  }, []);

  const submit = useCallback(
    async (full: string) => {
      if (setupMode) {
        if (phase === "enter") {
          setFirstCode(full);
          setCode("");
          setPhase("confirm");
          setError(null);
          return;
        }
        // confirm
        if (full !== firstCode) {
          failShake("Codes didn't match. Try again.");
          setPhase("enter");
          setFirstCode("");
          return;
        }
        await setPasscode(full);
        onUnlocked();
        return;
      }

      const ok = await verifyPasscode(full);
      if (ok) {
        onUnlocked();
      } else {
        const left = lockoutRemainingMs();
        if (left > 0) {
          failShake(`Locked. Try again in ${Math.ceil(left / 1000)}s`);
        } else {
          failShake("Incorrect passcode");
        }
      }
    },
    [setupMode, phase, firstCode, failShake, onUnlocked],
  );

  const press = (d: string) => {
    if (lockoutLeft > 0) return;
    if (code.length >= PASSCODE_LENGTH) return;
    const next = code + d;
    setCode(next);
    setError(null);
    if (next.length === PASSCODE_LENGTH) {
      setTimeout(() => submit(next), 80);
    }
  };

  const backspace = () => {
    if (lockoutLeft > 0) return;
    setCode((c) => c.slice(0, -1));
    setError(null);
  };

  // Hardware keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lockoutLeft > 0) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        backspace();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, lockoutLeft]);

  const title = setupMode
    ? phase === "enter"
      ? "Create Passcode"
      : "Re-enter Passcode"
    : "Enter Passcode";

  const subtitle = setupMode
    ? phase === "enter"
      ? "Choose a 4-digit code"
      : "Enter the same 4 digits again"
    : "Enter the passcode to unlock";


  return (
    <div className="flex flex-col items-center gap-7 select-none">
      <div className="flex items-center justify-center text-white/90">
        <Lock className="h-8 w-8" strokeWidth={1.8} />
      </div>


      <div className="text-center">
        <h1 className="text-[20px] font-semibold tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-1 text-[13px] text-white/60">{subtitle}</p>
      </div>

      {/* Dots */}
      <div
        className={cn(
          "flex items-center gap-4 transition-transform",
          shake && "animate-[shake_0.35s_ease-in-out]",
        )}
      >
        {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => {
          const filled = i < code.length;
          return (
            <span
              key={i}
              className={cn(
                "h-3.5 w-3.5 rounded-full border transition-all duration-150",
                filled
                  ? "bg-white border-white scale-110"
                  : "border-white/40 bg-transparent",
                error && "border-red-400",
              )}
            />
          );
        })}
      </div>

      {/* Error / lockout */}
      <div className="h-5 text-[12.5px] text-red-300/90">
        {lockoutLeft > 0
          ? `Try again in ${Math.ceil(lockoutLeft / 1000)}s`
          : (error ?? "")}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-5 sm:gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <KeyButton key={n} onClick={() => press(String(n))} disabled={lockoutLeft > 0}>
            {n}
          </KeyButton>
        ))}
        <div className="h-[76px] w-[76px] sm:h-16 sm:w-16" />
        <KeyButton onClick={() => press("0")} disabled={lockoutLeft > 0}>
          0
        </KeyButton>
        <button
          type="button"
          onClick={backspace}
          disabled={lockoutLeft > 0 || code.length === 0}
          aria-label="Backspace"
          className="h-[76px] w-[76px] sm:h-16 sm:w-16 rounded-full flex items-center justify-center text-white/90 hover:bg-white/10 active:bg-white/15 active:scale-95 transition disabled:opacity-30"
        >
          <Delete className="h-6 w-6 sm:h-5 sm:w-5" />
        </button>
      </div>


      {setupMode ? (
        <p className="text-[11.5px] text-white/45">
          Keep it memorable — there's no recovery yet.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (confirm("Reset passcode? You'll create a new one.")) {
              clearPasscode();
              window.location.reload();
            }
          }}
          className="text-[12px] text-white/55 hover:text-white/80 underline-offset-4 hover:underline"
        >
          Forgot passcode?
        </button>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
};

const KeyButton = ({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "h-[76px] w-[76px] sm:h-16 sm:w-16 rounded-full",
      "bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.20]",
      "border border-white/15 backdrop-blur-xl",
      "text-[30px] sm:text-[26px] font-light text-white",
      "transition-all duration-100 active:scale-95",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
      "disabled:opacity-40 disabled:cursor-not-allowed",
    )}
  >
    {children}
  </button>
);
