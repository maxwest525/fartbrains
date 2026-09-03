import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle2, KeyRound, X, Phone } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/fartbrains-logo.png";

const LAST_EMAIL_KEY = "iv.auth.lastEmail.v1";
const LAST_PHONE_KEY = "iv.auth.lastPhone.v1";
const LAST_IDENTIFIER_KIND_KEY = "iv.auth.lastKind.v1"; // "email" | "phone"
const WELCOME_PENDING_KEY = "iv.welcome.pending.v1";

/**
 * Phone / SMS sign-in is only offered when an SMS provider is actually
 * configured in Supabase and has been tested. Shipping the toggle without one
 * puts a dead authentication method in front of paying customers: the code
 * sends, nothing arrives, and they cannot get in. Set
 * VITE_ENABLE_PHONE_AUTH=true once SMS is verified end to end.
 */
const PHONE_AUTH_ENABLED = import.meta.env.VITE_ENABLE_PHONE_AUTH === "true";

type Mode = "password" | "magic";
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

export const AuthScreen = () => {
  const [kind, setKind] = useState<Kind>("email");
  // kind can only ever leave "email" while PHONE_AUTH_ENABLED.
  const [mode, setMode] = useState<Mode>("password");
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
      if (PHONE_AUTH_ENABLED && (lastKind === "email" || lastKind === "phone")) setKind(lastKind);
      // If the user last logged in with phone, default to OTP mode (SMS).
      if (PHONE_AUTH_ENABLED && lastKind === "phone") setMode("magic");
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

  const signInPassword = async () => {
    if (!identifierValid || !password || sending) return;
    setSending(true);
    try {
      if (kind === "email") {
        const trimmed = email.trim();
        if (isSignUp) {
          const { error } = await supabase.auth.signUp({
            email: trimmed,
            password,
            options: { emailRedirectTo: `${window.location.origin}/` },
          });
          if (error) throw error;
          try { localStorage.setItem(WELCOME_PENDING_KEY, "1"); } catch { /* ignore */ }
          rememberSuccess();
          toast.success("Account created", { description: "Check your inbox to confirm your email." });
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
          if (error) throw error;
          rememberSuccess();
          toast.success("Signed in");
        }
      } else {
        if (isSignUp) {
          const { error } = await supabase.auth.signUp({ phone: normalizedPhone, password });
          if (error) throw error;
          try { localStorage.setItem(WELCOME_PENDING_KEY, "1"); } catch { /* ignore */ }
          rememberSuccess();
          toast.success("Account created", { description: "We texted a code to confirm your number." });
          setOtpSent(true);
        } else {
          const { error } = await supabase.auth.signInWithPassword({ phone: normalizedPhone, password });
          if (error) throw error;
          rememberSuccess();
          toast.success("Signed in");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't sign in");
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === "phone" && mode === "magic") {
      if (otpSent) verifyPhoneOtp(); else sendMagic();
      return;
    }
    mode === "password" ? signInPassword() : sendMagic();
  };

  return (
    <main className="relative min-h-dvh w-full flex items-center justify-center overflow-hidden text-foreground animate-fade-in">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(900px 600px at 50% 45%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.30) 100%)" }}
      />
      <div className="relative z-10 w-full max-w-sm mx-6">
        <div className="glass-card-strong rounded-3xl p-7 text-white">
          <div className="flex flex-col items-center gap-3 mb-6">
            <img src={logo} alt="FartBrains" className="w-40 h-auto drop-shadow-[0_0_30px_rgba(96,165,250,0.3)]" />
            <div className="text-center">
              <h1 className="font-display text-[22px] font-semibold tracking-tight text-[#f8fafc]">
                {sent ? "Check your inbox" : otpSent ? "Enter the code" : isSignUp ? "Create your account" : "Sign in"}
              </h1>
              <p className="mt-1 text-[13px] text-[#f8fafc]/90">
                {sent
                  ? `We sent a magic link to ${email.trim()}. Tap it to continue.`
                  : otpSent
                    ? `We texted a 6-digit code to ${normalizedPhone}.`
                    : mode === "password"
                      ? (isSignUp ? "Sign up with a password." : "Sign in with your password.")
                      : kind === "email" ? "We'll email you a magic link." : "We'll text you a one-time code."}
              </p>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center h-14 rounded-2xl bg-white/[0.06] border border-white/10 text-emerald-300">
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
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              {/* Email / Phone toggle */}
              {PHONE_AUTH_ENABLED && !otpSent && (
                <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/10">
                  {(["email", "phone"] as Kind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { setKind(k); setOtpSent(false); setOtp(""); }}
                      className={`flex-1 h-9 rounded-xl text-[13px] font-medium transition ${
                        kind === k ? "bg-white/[0.10] text-white" : "text-white/60 hover:text-white/90"
                      }`}
                    >
                      {k === "email" ? "Email" : "Phone"}
                    </button>
                  ))}
                </div>
              )}

              {showRememberedPill ? (
                <div className="flex items-center justify-between gap-2 h-14 px-4 rounded-2xl bg-white/[0.06] border border-white/10">
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
                  className="h-14 rounded-2xl text-[16px] px-4"
                />
              ) : (
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  autoFocus
                  placeholder="+1 555 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-14 rounded-2xl text-[16px] px-4"
                />
              )}

              {/* Password field: email/password or phone/password sign-in */}
              {mode === "password" && !otpSent && (
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 rounded-2xl text-[16px] px-4"
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
                  className="h-14 rounded-2xl text-[16px] px-4 tracking-widest text-center"
                />
              )}

              <Button
                type="submit"
                disabled={
                  sending ||
                  !identifierValid ||
                  (mode === "password" && !password) ||
                  (kind === "phone" && mode === "magic" && otpSent && otp.length < 4)
                }
                className="h-14 rounded-2xl brand-gradient text-white text-[15px] font-semibold"
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

              {kind === "phone" && mode === "magic" && otpSent && (
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(""); }}
                  className="text-[12px] text-white/60 hover:text-white/90"
                >
                  Use a different number
                </button>
              )}

              {mode === "password" && (
                <button
                  type="button"
                  onClick={() => setIsSignUp((v) => !v)}
                  className="text-[12px] text-white/70 hover:text-white mt-1"
                >
                  {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
                </button>
              )}

              {!otpSent && (
                <button
                  type="button"
                  onClick={() => setMode(mode === "password" ? "magic" : "password")}
                  className="text-[12px] text-white/60 hover:text-white/90"
                >
                  {mode === "password"
                    ? (kind === "phone" ? "Text me a code instead" : "Use magic link instead")
                    : "Use password instead"}
                </button>
              )}

              {mode === "password" && !isSignUp && kind === "email" && (
                <button
                  type="button"
                  onClick={sendPasswordReset}
                  disabled={!isValidEmail || sending}
                  className="text-[12px] text-white/70 hover:text-white disabled:opacity-40"
                >
                  Forgot your password?
                </button>
              )}

              {mode === "password" && (
                <button
                  type="button"
                  onClick={setPasswordForAccount}
                  className="text-[11px] text-white/40 hover:text-white/70"
                >
                  (Already signed in? Tap to save this as your password)
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
};
