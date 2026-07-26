import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle2, KeyRound, X, Phone, Delete } from "lucide-react";
import { toast } from "sonner";
import { isEmailAllowed } from "@/lib/allowlist";
import { cn } from "@/lib/utils";
import logo from "@/assets/fartbrains-logo.png";

const PIN_LENGTH = 4;

const LAST_EMAIL_KEY = "iv.auth.lastEmail.v1";
const LAST_PHONE_KEY = "iv.auth.lastPhone.v1";
const LAST_IDENTIFIER_KIND_KEY = "iv.auth.lastKind.v1"; // "email" | "phone"
const WELCOME_PENDING_KEY = "iv.welcome.pending.v1";

type Mode = "pin" | "password" | "magic";
type Kind = "email" | "phone";

/** Normalize free-form phone input to E.164 (best-effort). */
const normalizePhone = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  // Assume 10-digit input is US/CA — a common enough default; users abroad can type "+".
  if (digits.length === 10) return `+1${digits}`;
  return digits ? `+${digits}` : "";
};

const isValidE164 = (v: string) => /^\+[1-9]\d{7,14}$/.test(v);

/** Pretty-format phone input as the user types. Supports US (default) and intl (+..). */
const formatPhoneInput = (raw: string): string => {
  const trimmed = raw.trimStart();
  if (!trimmed) return "";
  // International: keep leading + and group digits in 3s after country code.
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "").slice(0, 15);
    if (!digits) return "+";
    // US-style pretty print for +1 XXX XXX XXXX
    if (digits.startsWith("1") && digits.length > 1) {
      const rest = digits.slice(1);
      const a = rest.slice(0, 3);
      const b = rest.slice(3, 6);
      const c = rest.slice(6, 10);
      return `+1${a ? " " + a : ""}${b ? " " + b : ""}${c ? " " + c : ""}`;
    }
    // Generic: "+CC XXX XXX XXXX..."
    const cc = digits.slice(0, Math.min(3, Math.max(1, digits.length - 7)));
    const rest = digits.slice(cc.length);
    const groups = rest.match(/.{1,3}/g)?.join(" ") ?? "";
    return `+${cc}${groups ? " " + groups : ""}`;
  }
  // Domestic US: (XXX) XXX-XXXX
  const digits = trimmed.replace(/\D/g, "").slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 10);
  if (digits.length <= 3) return a ? `(${a}` + (digits.length === 3 ? ") " : "") : "";
  if (digits.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
};

export const AuthScreen = () => {
  const [kind, setKind] = useState<Kind>("email");
  const [mode, setMode] = useState<Mode>("pin");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Prefill last-used identifier so returning users can jump straight to password/PIN.
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
  const [rememberedPhone, setRememberedPhone] = useState<string | null>(null);
  useEffect(() => {
    try {
      const lastEmail = localStorage.getItem(LAST_EMAIL_KEY);
      const lastPhone = localStorage.getItem(LAST_PHONE_KEY);
      const lastKind = localStorage.getItem(LAST_IDENTIFIER_KIND_KEY) as Kind | null;
      if (lastEmail) { setEmail(lastEmail); setRememberedEmail(lastEmail); }
      if (lastPhone) { setPhone(lastPhone); setRememberedPhone(lastPhone); }
      if (lastKind === "email" || lastKind === "phone") setKind(lastKind);
      // If the user last logged in with phone, default to OTP mode (SMS).
      if (lastKind === "phone") setMode("magic");
      // Otherwise keep PIN as the default.
    } catch { /* ignore */ }
  }, []);

  const forgetIdentifier = () => {
    try {
      if (kind === "email") localStorage.removeItem(LAST_EMAIL_KEY);
      else localStorage.removeItem(LAST_PHONE_KEY);
    } catch { /* ignore */ }
    if (kind === "email") { setRememberedEmail(null); setEmail(""); }
    else { setRememberedPhone(null); setPhone(""); }
    setPassword("");
    setOtp("");
    setOtpSent(false);
  };

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const normalizedPhone = normalizePhone(phone);
  const isValidPhone = isValidE164(normalizedPhone);
  const identifierValid = kind === "email" ? isValidEmail : isValidPhone;

  const rememberSuccess = () => {
    try {
      if (kind === "email") localStorage.setItem(LAST_EMAIL_KEY, email.trim());
      else localStorage.setItem(LAST_PHONE_KEY, normalizedPhone);
      localStorage.setItem(LAST_IDENTIFIER_KIND_KEY, kind);
    } catch { /* ignore */ }
  };

  const sendMagic = async () => {
    if (!identifierValid || sending) return;
    setSending(true);
    try {
      if (kind === "email") {
        const trimmed = email.trim();
        if (!isEmailAllowed(trimmed)) {
          toast.error("This email isn't allowed to sign in.");
          return;
        }
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmed,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        rememberSuccess();
        setSent(true);
        toast.success("Magic link sent", { description: "Check your inbox to sign in." });
      } else {
        const { error } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });
        if (error) throw error;
        rememberSuccess();
        setOtpSent(true);
        toast.success("Code sent", { description: `We texted a code to ${normalizedPhone}.` });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send code");
    } finally {
      setSending(false);
    }
  };

  const verifyPhoneOtp = async () => {
    if (!isValidPhone || !otp || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp.trim(),
        type: "sms",
      });
      if (error) throw error;
      rememberSuccess();
      toast.success("Signed in");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setSending(false);
    }
  };

  const signInPassword = async (overridePassword?: string) => {
    const pw = overridePassword ?? password;
    if (!identifierValid || !pw || sending) return;
    setSending(true);
    try {
      if (kind === "email") {
        const trimmed = email.trim();
        if (!isEmailAllowed(trimmed)) {
          toast.error("This email isn't allowed to sign in.");
          return;
        }
        if (isSignUp) {
          const { error } = await supabase.auth.signUp({
            email: trimmed,
            password: pw,
            options: { emailRedirectTo: `${window.location.origin}/` },
          });
          if (error) throw error;
          try { localStorage.setItem(WELCOME_PENDING_KEY, "1"); } catch { /* ignore */ }
          rememberSuccess();
          toast.success("Account created", { description: "Check your inbox to confirm your email." });
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password: pw });
          if (error) throw error;
          rememberSuccess();
          toast.success("Signed in");
        }
      } else {
        if (isSignUp) {
          const { error } = await supabase.auth.signUp({ phone: normalizedPhone, password: pw });
          if (error) throw error;
          try { localStorage.setItem(WELCOME_PENDING_KEY, "1"); } catch { /* ignore */ }
          rememberSuccess();
          toast.success("Account created", { description: "We texted a code to confirm your number." });
          setOtpSent(true);
        } else {
          const { error } = await supabase.auth.signInWithPassword({ phone: normalizedPhone, password: pw });
          if (error) throw error;
          rememberSuccess();
          toast.success("Signed in");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't sign in");
      if (mode === "pin") setPassword("");
    } finally {
      setSending(false);
    }
  };

  const setPasswordForAccount = async () => {
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password set — use it to sign in next time");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't set password");
    } finally {
      setSending(false);
    }
  };

  const sendPasswordReset = async () => {
    if (kind !== "email" || !isValidEmail || sending) return;
    const trimmed = email.trim();
    if (!isEmailAllowed(trimmed)) {
      toast.error("This email isn't allowed to sign in.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset email sent", {
        description: `Check ${trimmed} for a link to set a new password.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send reset email");
    } finally {
      setSending(false);
    }
  };

  const rememberedIdentifier = kind === "email" ? rememberedEmail : rememberedPhone;
  const currentIdentifier = kind === "email" ? email : phone;
  const showRememberedPill = rememberedIdentifier && currentIdentifier === rememberedIdentifier;

  /** Supabase requires ≥6 char passwords; derive a deterministic value from the 4-digit PIN. */
  const pinToPassword = (pin: string) => `${pin}-fbpin`;

  const pressPin = useCallback((d: string) => {
    if (sending) return;
    setPassword((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + d;
      if (next.length === PIN_LENGTH && identifierValid) {
        setTimeout(() => { signInPassword(pinToPassword(next)); }, 80);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, identifierValid]);

  const backspacePin = () => setPassword((p) => p.slice(0, -1));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === "phone" && mode === "magic") {
      if (otpSent) verifyPhoneOtp(); else sendMagic();
      return;
    }
    if (mode === "pin") {
      signInPassword(pinToPassword(password));
      return;
    }
    (mode === "password") ? signInPassword() : sendMagic();
  };

  return (
    <main className="relative min-h-dvh w-full flex items-center justify-center overflow-hidden text-foreground animate-fade-in">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(900px 600px at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.30) 100%)" }}
      />
      <div className="relative z-10 w-full max-w-sm mx-4 my-3">
        <div className="glass-card-strong rounded-3xl px-5 py-4 text-white">
          <div className="flex flex-col items-center gap-1.5 mb-3">
            <img src={logo} alt="FartBrains" className="w-24 h-auto drop-shadow-[0_0_30px_rgba(96,165,250,0.3)]" />
            <div className="text-center">
              <h1 className="font-display text-[18px] font-semibold tracking-tight text-[#f8fafc]">
                {sent ? "Check your inbox" : otpSent ? "Enter the code" : isSignUp ? "Create your account" : "Sign in"}
              </h1>
              <p className="mt-0.5 text-[12px] text-[#f8fafc]/90">
                {sent
                  ? `We sent a magic link to ${email.trim()}. Tap it to continue.`
                  : otpSent
                    ? `We texted a 6-digit code to ${normalizedPhone}.`
                    : mode === "pin"
                      ? (isSignUp ? "Pick a 4-digit PIN to secure your account." : "Enter your 4-digit PIN.")
                      : mode === "password"
                        ? (isSignUp ? "Sign up with a password." : "Sign in with your password.")
                        : kind === "email" ? "We'll email you a magic link." : "We'll text you a one-time code."}
              </p>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center h-12 rounded-2xl bg-white/[0.06] border border-white/10 text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <Button variant="ghost" onClick={() => setSent(false)} className="text-white/70 hover:text-white">
                Use a different email
              </Button>
              <Button onClick={sendMagic} disabled={sending} className="brand-gradient text-white">
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                Resend link
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-2">
              {/* Email / Phone toggle */}
              {!otpSent && (
                <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
                  {(["email", "phone"] as Kind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { setKind(k); setOtpSent(false); setOtp(""); }}
                      className={`flex-1 h-8 rounded-xl text-[12.5px] font-medium transition ${
                        kind === k ? "bg-white/[0.10] text-white" : "text-white/60 hover:text-white/90"
                      }`}
                    >
                      {k === "email" ? "Email" : "Phone"}
                    </button>
                  ))}
                </div>
              )}

              {showRememberedPill ? (
                <div className="flex items-center justify-between gap-2 h-12 px-4 rounded-2xl bg-white/[0.06] border border-white/10">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10.5px] uppercase tracking-wider text-white/50">Continuing as</span>
                    <span className="text-[14px] font-medium text-white truncate">{rememberedIdentifier}</span>
                  </div>
                  <button
                    type="button"
                    onClick={forgetIdentifier}
                    aria-label={`Use a different ${kind}`}
                    className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.08]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : kind === "email" ? (
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-2xl text-[16px] px-4"
                />
              ) : (
                <div className="flex flex-col gap-1">
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    autoFocus
                    placeholder="(555) 123-4567"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    aria-invalid={phone.length > 0 && !isValidPhone}
                    className={`h-12 rounded-2xl text-[16px] px-4 ${
                      phone.length > 0 && !isValidPhone ? "border-destructive/70" : ""
                    }`}
                  />
                  {phone.length > 0 && !isValidPhone && (
                    <p role="alert" className="text-[11px] text-destructive/90 px-1">
                      Enter a valid phone number (e.g. (555) 123-4567 or +44 20 7946 0958).
                    </p>
                  )}
                </div>
              )}

              {/* PIN entry: 4-digit keypad, derived into a ≥6 char password server-side. */}
              {mode === "pin" && !otpSent && (
                <div className="flex flex-col items-center gap-2 py-0">
                  {/* Dots */}
                  <div className="flex items-center gap-4">
                    {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-3.5 w-3.5 rounded-full border transition-all duration-150",
                          i < password.length
                            ? "bg-white border-white scale-110"
                            : "border-white/40 bg-transparent",
                        )}
                      />
                    ))}
                  </div>
                  {/* Keypad */}
                  <div className="grid grid-cols-3 gap-2">
                    {[1,2,3,4,5,6,7,8,9].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => pressPin(String(n))}
                        disabled={sending || !identifierValid}
                        className="h-12 w-12 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.20] border border-white/15 backdrop-blur-xl text-[20px] font-light text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPassword("")}
                      disabled={sending || password.length === 0}
                      aria-label="Clear PIN"
                      className="h-12 w-12 rounded-full flex items-center justify-center text-[12px] font-medium text-white/80 hover:bg-white/10 active:bg-white/15 active:scale-95 transition disabled:opacity-30"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => pressPin("0")}
                      disabled={sending || !identifierValid}
                      className="h-12 w-12 rounded-full bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.20] border border-white/15 backdrop-blur-xl text-[20px] font-light text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={backspacePin}
                      disabled={sending || password.length === 0}
                      aria-label="Backspace"
                      className="h-12 w-12 rounded-full flex items-center justify-center text-white/90 hover:bg-white/10 active:bg-white/15 active:scale-95 transition disabled:opacity-30"
                    >
                      <Delete className="h-5 w-5" />
                    </button>
                  </div>
                  {!identifierValid && (
                    <p className="text-[11.5px] text-white/50 text-center">
                      Enter your {kind === "email" ? "email" : "phone number"} above to use the keypad.
                    </p>
                  )}
                </div>
              )}

              {/* Full password entry */}
              {mode === "password" && !otpSent && (
                <Input
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-2xl text-[16px] px-4"
                />
              )}

              {/* SMS OTP entry */}
              {kind === "phone" && mode === "magic" && otpSent && (
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="6-digit code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="h-12 rounded-2xl text-[16px] px-4 tracking-widest text-center"
                />
              )}

              {mode !== "pin" && (
                <Button
                  type="submit"
                  disabled={
                    sending ||
                    !identifierValid ||
                    (mode === "password" && !password) ||
                    (kind === "phone" && mode === "magic" && otpSent && otp.length < 4)
                  }
                  className="h-12 rounded-2xl brand-gradient text-white text-[15px] font-semibold"
                >
                  {sending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Working…</>
                  ) : kind === "phone" && mode === "magic" && otpSent ? (
                    <><KeyRound className="h-4 w-4 mr-2" /> Verify code</>
                  ) : mode === "password" ? (
                    <><KeyRound className="h-4 w-4 mr-2" /> {isSignUp ? "Create account" : "Sign in"}</>
                  ) : kind === "phone" ? (
                    <><Phone className="h-4 w-4 mr-2" /> Text me a code</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" /> Send magic link</>
                  )}
                </Button>
              )}
              {mode === "pin" && sending && (
                <div className="flex items-center justify-center h-10 text-white/70 text-[13px]">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Working…
                </div>
              )}

              {kind === "phone" && mode === "magic" && otpSent && (
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(""); }}
                  className="text-[12px] text-white/60 hover:text-white/90"
                >
                  Use a different number
                </button>
              )}

              {(mode === "password" || mode === "pin") && (
                <button
                  type="button"
                  onClick={() => setIsSignUp((v) => !v)}
                  className="text-[12px] text-white/70 hover:text-white mt-1"
                >
                  {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
                </button>
              )}

              {!otpSent && (
                <div className="flex flex-col items-center gap-1.5 pt-1">
                  {mode !== "pin" && (
                    <button
                      type="button"
                      onClick={() => { setMode("pin"); setPassword(""); }}
                      className="text-[12px] text-white/70 hover:text-white"
                    >
                      Use PIN instead
                    </button>
                  )}
                  {mode !== "password" && (
                    <button
                      type="button"
                      onClick={() => { setMode("password"); setPassword(""); }}
                      className="text-[12px] text-white/60 hover:text-white/90"
                    >
                      Use password instead
                    </button>
                  )}
                  {mode !== "magic" && (
                    <button
                      type="button"
                      onClick={() => setMode("magic")}
                      className="text-[12px] text-white/60 hover:text-white/90"
                    >
                      {kind === "phone" ? "Text me a code instead" : "Use magic link instead"}
                    </button>
                  )}
                </div>
              )}

              {(mode === "password" || mode === "pin") && !isSignUp && kind === "email" && (
                <button
                  type="button"
                  onClick={sendPasswordReset}
                  disabled={!isValidEmail || sending}
                  className="text-[12px] text-white/70 hover:text-white disabled:opacity-40"
                >
                  {mode === "pin" ? "Forgot your PIN?" : "Forgot your password?"}
                </button>
              )}

              {(mode === "password" || mode === "pin") && (
                <button
                  type="button"
                  onClick={setPasswordForAccount}
                  className="text-[11px] text-white/40 hover:text-white/70"
                >
                  (Already signed in? Tap to save this {mode === "pin" ? "PIN" : "password"})
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
};
