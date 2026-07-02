import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { isEmailAllowed } from "@/lib/allowlist";
import logo from "@/assets/fartbrains-logo.png";

export const AuthScreen = () => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const send = async () => {
    if (!isValid || sending) return;
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
          shouldCreateUser: false,
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
                {sent ? "Check your inbox" : "Sign in or sign up"}
              </h1>
              <p className="mt-1 text-[13px] text-[#f8fafc]/90">
                {sent
                  ? `We sent a magic link to ${email.trim()}. Tap it to continue.`
                  : "We'll email you a magic link. No password needed."}
              </p>
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-center h-14 rounded-2xl bg-white/[0.06] border border-white/10 text-emerald-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <Button
                variant="ghost"
                onClick={() => { setSent(false); }}
                className="text-white/70 hover:text-white"
              >
                Use a different email
              </Button>
              <Button
                onClick={send}
                disabled={sending}
                className="brand-gradient text-white"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                Resend link
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
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
              <Button
                type="submit"
                disabled={!isValid || sending}
                className="h-14 rounded-2xl brand-gradient text-white text-[15px] font-semibold"
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending…</>
                ) : (
                  <><Mail className="h-4 w-4 mr-2" /> Send magic link</>
                )}
              </Button>
              <p className="text-[11.5px] text-white/45 text-center mt-1">
                By continuing you agree to be contacted at this email.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
};
