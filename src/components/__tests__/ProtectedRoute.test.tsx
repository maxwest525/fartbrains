import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";

// --- Supabase client stub -------------------------------------------------
const h = vi.hoisted(() => ({
  signOut: vi.fn(async () => ({ error: null })),
  signInAnonymously: vi.fn(async () => ({ data: {}, error: null })),
  session: null as unknown,
}));
const { signOut, signInAnonymously } = h;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: h.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: h.signOut,
      signInAnonymously: h.signInAnonymously,
    },
  },
}));

// Keep the gate's neighbours out of the render tree; we only assert routing.
vi.mock("@/components/auth/SplashScreen", () => ({
  SplashScreen: ({ onDone }: { onDone: () => void }) => {
    onDone();
    return <div>splash</div>;
  },
}));
vi.mock("@/components/auth/AuthScreen", () => ({
  AuthScreen: () => <div>sign-in-screen</div>,
}));
vi.mock("@/components/auth/WelcomeBackScreen", () => ({
  WelcomeBackScreen: () => <div>welcome</div>,
}));
vi.mock("@/components/auth/PasscodeKeypad", () => ({
  PasscodeKeypad: () => <div>keypad</div>,
}));

import { ProtectedRoute } from "@/components/ProtectedRoute";

const session = (over: Record<string, unknown> = {}): Session =>
  ({ user: { id: "u1", email: "a@b.co", ...over } } as unknown as Session);

const renderGate = () =>
  render(
    <ProtectedRoute>
      <div>private-app</div>
    </ProtectedRoute>,
  );

beforeEach(() => {
  h.session = null;
  signOut.mockClear();
  signInAnonymously.mockClear();
  sessionStorage.setItem("iv.splash.shown.v1", "1");
  localStorage.clear();
});
afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe("ProtectedRoute", () => {
  it("shows the sign-in screen when there is no session", async () => {
    renderGate();
    expect(await screen.findByText("sign-in-screen")).toBeInTheDocument();
    expect(screen.queryByText("private-app")).not.toBeInTheDocument();
  });

  it("never mints an anonymous session for a visitor", async () => {
    renderGate();
    await screen.findByText("sign-in-screen");
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("rejects an anonymous session and signs it out", async () => {
    h.session = session({ is_anonymous: true });
    renderGate();
    expect(await screen.findByText("sign-in-screen")).toBeInTheDocument();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it("renders the app for a real signed-in user", async () => {
    h.session = session();
    renderGate();
    expect(await screen.findByText("private-app")).toBeInTheDocument();
  });

  it("does not block first run with an app-lock setup prompt", async () => {
    h.session = session();
    renderGate();
    expect(await screen.findByText("private-app")).toBeInTheDocument();
    expect(screen.queryByText("keypad")).not.toBeInTheDocument();
  });

  it("asks for the passcode when app lock is configured on this device", async () => {
    h.session = session();
    localStorage.setItem("iv.passcode.hash.v1", "deadbeef");
    renderGate();
    expect(await screen.findByText("keypad")).toBeInTheDocument();
    expect(screen.queryByText("private-app")).not.toBeInTheDocument();
  });
});
