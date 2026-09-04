import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/useTheme";
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
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
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
            <Route path="/landing" element={<Navigate to="/?landing" replace />} />

            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/settings/prompt-rules" element={<PromptRules />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings/instructions" element={<Instructions />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
