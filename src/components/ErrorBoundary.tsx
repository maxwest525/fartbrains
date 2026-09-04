import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

type ErrorSink = (error: Error, info: { componentStack?: string }) => void;

let errorSink: ErrorSink | null = null;

/**
 * Install a crash reporter. Unset, crashes are logged to the console only —
 * no reporting provider is wired yet, and reports must be reviewed for what
 * they carry before one is: a React error message can quote rendered content,
 * which here means someone's private notes.
 */
export function setErrorSink(next: ErrorSink | null): void {
  errorSink = next;
}

/**
 * Catches render crashes so a single broken screen does not leave the customer
 * staring at a blank page with their brain apparently gone.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error);
    try {
      errorSink?.(error, { componentStack: info.componentStack ?? undefined });
    } catch {
      /* reporting must never make a crash worse */
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-dvh flex items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold mb-2">Something broke on this screen</h1>
          <p className="text-sm text-muted-foreground mb-5">
            Your notes are safe — nothing was lost. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-11 px-6 rounded-full bg-primary text-primary-foreground text-sm font-medium"
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}
