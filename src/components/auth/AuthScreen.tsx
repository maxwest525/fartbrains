import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { isEmailAllowed } from "@/lib/allowlist";
import logo from "@/assets/fartbrains-logo.png";

type Mode = "password" | "magic";

export const AuthScreen = () => {
  const [mode, setMode] = useState<Mode>("password");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const sendMagic = async () => {
    if (!isValidEmail || sending) return;
    const trimmed = email.trim();
    if (!isEmailAllowed(trimmed)) {
      toast.error("This email isn't allowed to sign in.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Magic link sent", { description: "Check your inbox to sign in." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send magic link");
    } finally {
      setSending(false);
    }
  };

  const signInPassword = async () => {
    if (!isValidEmail || !password || sending) return;
    const trimmed = email.trim();
    if (!isEmailAllowed(trimmed)) {
      toast.error("This email isn't allowed to sign in.");
      return;
    }
    setSending(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: trimmed,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created", { description: "Check your inbox to confirm your email." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't sign in");
    } finally {
      setSending(false);
    }
  };

  const setPasswordForAccount = async () => {
    // One-time helper: after signing in with magic link, call this to set a password
    // so you don't need magic link again. Exposed via the "Set a password" button below.
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
                {sent ? "Check your inbox" : isSignUp ? "Create your account" : "Sign in"}
              </h1>
              <p className="mt-1 text-[13px] text-[#f8fafc]/90">
                {sent
                  ? `We sent a magic link to ${email.trim()}. Tap it to continue.`
                  : mode === "password"
                    ? (isSignUp ? "Sign up with email and password." : "Sign in with your password.")
                    : "We'll email you a magic link."}
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
            <form
              onSubmit={(e) => { e.preventDefault(); mode === "password" ? signInPassword() : sendMagic(); }}
              className="flex flex-col gap-3"
            >
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
              {mode === "password" && (
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 rounded-2xl text-[16px] px-4"
                />
              )}
              <Button
                type="submit"
                disabled={!isValidEmail || sending || (mode === "password" && !password)}
                className="h-14 rounded-2xl brand-gradient text-white text-[15px] font-semibold"
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> {mode === "password" ? (isSignUp ? "Creating…" : "Signing in…") : "Sending…"}</>
                ) : mode === "password" ? (
                  <><KeyRound className="h-4 w-4 mr-2" /> {isSignUp ? "Create account" : "Sign in"}</>
                ) : (
                  <><Mail className="h-4 w-4 mr-2" /> Send magic link</>
                )}
              </Button>

              {mode === "password" && (
                <button
                  type="button"
                  onClick={() => setIsSignUp((v) => !v)}
                  className="text-[12px] text-white/70 hover:text-white mt-1"
                >
                  {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setMode(mode === "password" ? "magic" : "password")}
                className="text-[12px] text-white/60 hover:text-white/90"
              >
                {mode === "password" ? "Use magic link instead" : "Use password instead"}
              </button>

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
