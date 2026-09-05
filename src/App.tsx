import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { IdeaCreatedFx } from "@/components/app/IdeaCreatedFx";
import { DesktopWindowControls } from "@/components/app/DesktopWindowControls";
import { InstallAppPrompt } from "@/components/app/InstallAppPrompt";
import { useLandingActive } from "@/lib/landingMode";
import { installCrashReporting } from "@/lib/installCrashReporting";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";

/* Settings screens, legal pages, the share receiver and the shared-idea view
   are not on the path of a normal visit, so they are split out. Index and
   Auth stay eager: splitting the first screen only adds a round trip to the
   thing everyone loads. */
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const PromptRules = lazy(() => import("./pages/PromptRules"));
const Profile = lazy(() => import("./pages/Profile"));
const Instructions = lazy(() => import("./pages/Instructions"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SharedIdea = lazy(() => import("./pages/SharedIdea"));
const Share = lazy(() => import("./pages/Share"));
const Connect = lazy(() => import("./pages/Connect"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SyncAccount = lazy(() => import("./pages/SyncAccount"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const NotFound = lazy(() => import("./pages/NotFound"));



const queryClient = new QueryClient();

// App chrome belongs to the vault, not to the landing page — the landing page
// is a full-bleed marketing screen and shouldn't have a window titlebar or an
// install pill floating over it.
const AppChrome = () => {
  if (useLandingActive()) return null;
  return (
    <>
      <Toaster />
      <Sonner />
      <IdeaCreatedFx />
      <DesktopWindowControls />
      <InstallAppPrompt />
    </>
  );
};

// Installed at module scope so it is listening before the first render, which
// is where a crash is most likely.
installCrashReporting();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppChrome />
        <BrowserRouter>
          <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/landing" element={<Navigate to="/?landing" replace />} />

            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/settings/prompt-rules" element={<PromptRules />} />
            <Route path="/settings/connect" element={<Connect />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings/instructions" element={<Instructions />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/settings/sync" element={<SyncAccount />} />
            {/* Public, read-only view of a single shared idea. */}
            <Route path="/s/:token" element={<SharedIdea />} />
            <Route path="/share" element={<Share />} />
            {/* Public legal pages — currently WIP drafts. */}
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
