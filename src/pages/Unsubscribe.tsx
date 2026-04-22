import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type State =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "success" }
  | { kind: "error"; message: string };

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: "error", message: "Missing unsubscribe token." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${FUNCTIONS_URL}?token=${encodeURIComponent(token)}`,
          { headers: { apikey: ANON_KEY } },
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setState({
            kind: "error",
            message: data?.error ?? "Invalid or expired link.",
          });
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState({ kind: "already" });
          return;
        }
        setState({ kind: "ready" });
      } catch {
        if (!cancelled) {
          setState({ kind: "error", message: "Network error. Try again." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(FUNCTIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({
          kind: "error",
          message: data?.error ?? "Could not unsubscribe.",
        });
        return;
      }
      if (data.success) {
        setState({ kind: "success" });
      } else if (data.reason === "already_unsubscribed") {
        setState({ kind: "already" });
      } else {
        setState({ kind: "error", message: "Could not unsubscribe." });
      }
    } catch {
      setState({ kind: "error", message: "Network error. Try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Unsubscribe from email reminders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.kind === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Validating your link…
            </div>
          )}
          {state.kind === "ready" && (
            <>
              <p className="text-sm text-muted-foreground">
                Click below to stop receiving email reminders. You can still
                manage notifications from the app.
              </p>
              <Button
                onClick={confirm}
                disabled={submitting}
                className="w-full"
              >
                {submitting ? "Unsubscribing…" : "Confirm unsubscribe"}
              </Button>
            </>
          )}
          {state.kind === "success" && (
            <p className="text-sm">
              You've been unsubscribed. We won't send you any more email
              reminders.
            </p>
          )}
          {state.kind === "already" && (
            <p className="text-sm text-muted-foreground">
              This email is already unsubscribed.
            </p>
          )}
          {state.kind === "error" && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Unsubscribe;
