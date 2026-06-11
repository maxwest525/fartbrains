import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { isEmailAllowed } from "@/lib/allowlist";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
import spaceBg from "@/assets/space-nebula.jpg";

const credSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isEmailAllowed(user.email)) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = credSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!isEmailAllowed(parsed.data.email)) {
      toast.error("This app is private. Access denied.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        navigate("/", { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="gemini dark relative min-h-dvh w-full flex items-center justify-center p-4 overflow-hidden bg-[color:var(--g-surface-0)]">
      {/* Deep-space backdrop */}
      <img
        src={spaceBg}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover scale-110"
        fetchPriority="high"
      />
      {/* Atmospheric scrim to keep the form readable */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 50%, rgba(0,0,0,0.35), rgba(0,0,0,0.7) 80%)",
        }}
      />
      {/* Glassmorphism card */}
      <div className="relative w-full max-w-md">
        <div className="gemini-ring rounded-3xl">
          <div
            className="rounded-3xl bg-white/[0.06] backdrop-blur-2xl backdrop-saturate-150 border border-white/10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] p-7 sm:p-8"
          >
            <div className="flex items-center gap-3 mb-7">
              <div
                className="h-11 w-11 rounded-2xl flex items-center justify-center text-white shadow-[0_8px_24px_-8px_rgba(155,114,203,0.7)]"
                style={{ background: "var(--g-gradient)" }}
              >
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-[18px] font-semibold tracking-tight text-white">Idea Vault</h1>
                <p className="text-[12.5px] text-white/60">Private · single user only</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-white/80 text-[12.5px] font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-white/[0.06] border-white/15 text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-[color:var(--g-focus-ring)] focus-visible:ring-offset-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-white/80 text-[12.5px] font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-white/[0.06] border-white/15 text-white placeholder:text-white/40 focus-visible:ring-2 focus-visible:ring-[color:var(--g-focus-ring)] focus-visible:ring-offset-0"
                />
              </div>

              <Button type="submit" size="lg" className="w-full mt-2" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "signin" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </Button>

              <button
                type="button"
                className="text-[13px] text-white/60 hover:text-white transition-colors w-full text-center pt-1"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin"
                  ? "Need to create your account?"
                  : "Already have an account? Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Auth;
