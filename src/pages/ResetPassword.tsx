import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import logo from "@/assets/fartbrains-logo.png";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Supabase places the recovery access_token in the URL hash on arrival and
  // the client library exchanges it into a session. Wait for that session
  // before letting the user submit a new password — otherwise updateUser fails.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });
    // Also check for an already-established session (e.g. hot reload).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Password updated");
      setTimeout(() => navigate("/", { replace: true }), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update password");
    } finally {
      setSaving(false);
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
                {done ? "Password updated" : "Set a new password"}
              </h1>
              <p className="mt-1 text-[13px] text-[#f8fafc]/90">
                {done
                  ? "Redirecting you back in…"
                  : ready
                    ? "Enter a new password for your account."
                    : "Verifying your reset link…"}
              </p>
            </div>
          </div>

          {done ? (
            <div className="flex items-center justify-center h-14 rounded-2xl bg-white/[0.06] border border-white/10 text-emerald-300">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!ready || saving}
                className="h-14 rounded-2xl text-[16px] px-4"
              />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={!ready || saving}
                className="h-14 rounded-2xl text-[16px] px-4"
              />
              <Button
                type="submit"
                disabled={!ready || saving || !password || !confirm}
                className="h-14 rounded-2xl brand-gradient text-white text-[15px] font-semibold"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Updating…</>
                ) : (
                  <><KeyRound className="h-4 w-4 mr-2" /> Update password</>
                )}
              </Button>
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="text-[12px] text-white/60 hover:text-white/90 mt-1"
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
};

export default ResetPassword;
