import { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Lock, ScanFace } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/fartbrains-logo.png";
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
  markUnlocked,
} from "@/lib/passcode";
import {
  isBiometricSupported,
  hasBiometric,
  enrollBiometric,
  verifyBiometric,
  clearBiometric,
} from "@/lib/biometric";

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
  const [showForgot, setShowForgot] = useState(false);
  const [resetting, setResetting] = useState(false);

  const bioSupported = isBiometricSupported();
  const [bioEnrolled, setBioEnrolled] = useState<boolean>(() => hasBiometric());
  const [bioBusy, setBioBusy] = useState(false);
  const autoBioRef = useRef(false);

  // Tick the lockout countdown.
  useEffect(() => {
    const id = setInterval(() => setLockoutLeft(lockoutRemainingMs()), 500);
    setLockoutLeft(lockoutRemainingMs());
    return () => clearInterval(id);
  }, []);

  const tryBiometric = useCallback(async () => {
    if (bioBusy || lockoutLeft > 0) return;
    setBioBusy(true);
    try {
      const ok = await verifyBiometric();
      if (ok) {
        markUnlocked();
        onUnlocked();
      }
    } catch {
      /* user cancelled */
    } finally {
      setBioBusy(false);
    }
  }, [bioBusy, lockoutLeft, onUnlocked]);

  // Auto-prompt Face ID once on unlock mount when enrolled.
  useEffect(() => {
    if (setupMode || autoBioRef.current) return;
    if (!bioSupported || !bioEnrolled) return;
    autoBioRef.current = true;
    void tryBiometric();
  }, [setupMode, bioSupported, bioEnrolled, tryBiometric]);

  const enableBiometric = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      const ok = await enrollBiometric();
      if (ok) {
        setBioEnrolled(true);
        toast.success("Face ID enabled");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't enable Face ID");
    } finally {
      setBioBusy(false);
    }
  };

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
      {setupMode ? (
        <div className="flex items-center justify-center text-white/90">
          <Lock className="h-8 w-8" strokeWidth={1.8} />
        </div>
      ) : (
        <img
          src={logo}
          alt="FartBrains"
          className="w-20 h-auto opacity-90 drop-shadow-[0_0_18px_rgba(96,165,250,0.25)]"
        />
      )}


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
          onClick={() => setShowForgot(true)}
          className="text-[12px] text-white/55 hover:text-white/80 underline-offset-4 hover:underline"
        >
          Forgot PIN?
        </button>
      )}

      <AlertDialog open={showForgot} onOpenChange={setShowForgot}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Of course you did.</AlertDialogTitle>
            <AlertDialogDescription>
              Your PIN is stored on this device, so there's nothing to "email"
              you. To reset it, we'll sign you out and take you back to the
              login screen. Sign in again with your email or phone, and you'll
              be prompted to create a new PIN.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Never mind</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetting}
              onClick={async (e) => {
                e.preventDefault();
                setResetting(true);
                try {
                  clearPasscode();
                  await supabase.auth.signOut();
                  toast.success("PIN cleared — sign back in to set a new one");
                  // Full reload so ProtectedRoute re-evaluates from a clean slate.
                  window.location.replace("/");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't reset PIN");
                  setResetting(false);
                }
              }}
            >
              {resetting ? "Signing out…" : "Sign out & reset PIN"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
