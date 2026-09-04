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
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";

import Unsubscribe from "./pages/Unsubscribe.tsx";
import PromptRules from "./pages/PromptRules.tsx";
import Profile from "./pages/Profile.tsx";
import Instructions from "./pages/Instructions.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import SharedIdea from "./pages/SharedIdea.tsx";
import Privacy from "./pages/Privacy.tsx";
import Terms from "./pages/Terms.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import SyncAccount from "./pages/SyncAccount.tsx";
import OAuthConsent from "./pages/OAuthConsent.tsx";
import NotFound from "./pages/NotFound.tsx";


const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <IdeaCreatedFx />
        <DesktopWindowControls />
        <InstallAppPrompt />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/auth" element={<Auth />} />

            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/settings/prompt-rules" element={<PromptRules />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings/instructions" element={<Instructions />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/settings/sync" element={<SyncAccount />} />
            {/* Public, read-only view of a single shared idea. */}
            <Route path="/s/:token" element={<SharedIdea />} />
            {/* Public legal pages — currently WIP drafts. */}
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
