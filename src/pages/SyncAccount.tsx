import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const MIN_PASSWORD = 8;
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

type Tab = "create" | "signin";

const SyncAccountInner = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("create");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // An anonymous session is device-local; a session with an email syncs.
  const isSynced = Boolean(user?.email);
  const pendingEmail = (user?.new_email as string | undefined) ?? null;

  /**
   * Upgrades the current (anonymous) session into a permanent account. Because
   * the user id never changes, every to-do, jot and idea already captured on
   * this device carries straight over.
   */
  const createAccount = async () => {
    if (busy) return;
    if (!isValidEmail(email)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      toast.error(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      await supabase
        .from("profiles")
        .upsert({ id: user?.id ?? "", email: email.trim() });
      setPassword("");
      setConfirm("");
      toast.success("Account created", {
        description: `Confirm the link we sent to ${email.trim()}, then sign in on your other device.`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create your account");
    } finally {
      setBusy(false);
    }
  };

  /** Signs this device into an existing account so everything pulls down. */
  const signIn = async () => {
    if (busy) return;
    if (!isValidEmail(email) || !password) {
      toast.error("Enter your email and password");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword("");
      toast.success("Signed in", { description: "Your vault is syncing to this device." });
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't sign in");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    if (busy) return;
    if (password.length < MIN_PASSWORD) {
      toast.error(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      toast.success("Password updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update your password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh px-5 pt-6 pb-24 max-w-md mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-muted-foreground press mb-5"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Sync account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a password so your to-dos, jots and composer drafts follow you between your
          phone and the desktop app.
        </p>
      </header>

      {isSynced ? (
        <section className="glass-card rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Syncing as</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          {pendingEmail ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Waiting on confirmation for {pendingEmail}. Tap the link in that inbox to finish
              the change.
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            <Label htmlFor="new-password" className="text-xs text-muted-foreground">
              Change password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bubble-input h-12 rounded-2xl text-[16px]"
            />
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="bubble-input h-12 rounded-2xl text-[16px]"
            />
            <Button
              variant="outline"
              onClick={changePassword}
              disabled={busy}
              className="w-full h-12 rounded-2xl"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Update password
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              void signOut();
              navigate("/");
            }}
            className="mt-4 w-full h-12 rounded-2xl text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out of this device
          </Button>
        </section>
      ) : (
        <section className="glass-card rounded-3xl p-5">
          <div
            role="tablist"
            aria-label="Account action"
            className="flex gap-1 p-1 rounded-2xl bg-foreground/[0.04] mb-4"
          >
            {([
              { id: "create" as Tab, label: "Create account" },
              { id: "signin" as Tab, label: "I have one" },
            ]).map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 h-9 rounded-xl text-[13px] font-medium transition ${
                  tab === t.id
                    ? "bg-foreground/[0.10] text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p className="mb-4 text-xs text-muted-foreground">
            {tab === "create"
              ? "Everything already saved on this device moves into the new account, nothing is lost."
              : "Signing in pulls down the vault saved under that account."}
          </p>

          <div className="space-y-3">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bubble-input h-12 rounded-2xl text-[16px]"
            />
            <Input
              type="password"
              autoComplete={tab === "create" ? "new-password" : "current-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bubble-input h-12 rounded-2xl text-[16px]"
            />
            {tab === "create" ? (
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="bubble-input h-12 rounded-2xl text-[16px]"
              />
            ) : null}
            <Button
              variant="outline"
              onClick={tab === "create" ? createAccount : signIn}
              disabled={busy}
              className="w-full h-12 rounded-2xl"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {tab === "create" ? "Create sync account" : "Sign in and sync"}
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Your passcode still locks this device. The password is only for signing in
            somewhere new.
          </p>
        </section>
      )}
    </div>
  );
};

export const SyncAccount = () => (
  <ProtectedRoute>
    <SyncAccountInner />
  </ProtectedRoute>
);

export default SyncAccount;
