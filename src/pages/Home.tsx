import { useNavigate } from "react-router-dom";
import { Sparkles, Mail, Calendar as CalendarIcon, AlertTriangle, BarChart3, Mic, Plus } from "lucide-react";
import { TodayPanel } from "@/components/app/home/TodayPanel";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { cn } from "@/lib/utils";

/**
 * Ash-style command home — desktop dashboard surface.
 * Mirrors the desktop app's homescreen so the web and desktop feel like
 * the same product.
 */
const HomeInner = () => {
  const navigate = useNavigate();

  const quickPills = [
    { icon: Mail, label: "Overnight inbox", tint: "text-rose-300" },
    { icon: BarChart3, label: "Pipeline review", tint: "text-blue-300" },
    {
      icon: CalendarIcon,
      label: "Today's calendar",
      tint: "text-emerald-300",
      onClick: () => navigate("/?view=calendar"),
    },
    { icon: AlertTriangle, label: "Alerts", tint: "text-amber-300" },
  ];

  return (
    <main className="gemini relative min-h-dvh w-full overflow-hidden bg-[color:var(--g-surface-0)] text-white">
      {/* Backdrop glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(800px 500px at 50% 28%, rgba(155,114,203,0.18), transparent 60%), radial-gradient(900px 600px at 80% 90%, rgba(66,133,244,0.12), transparent 65%)",
        }}
      />

      {/* Centered Ash hero */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pt-[14vh] pb-10 flex flex-col items-center text-center">
        <div className="flex items-center gap-3 mb-7">
          <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight">
            What can Ash do for you today?
          </h1>
          <AshOrb />
        </div>

        {/* Prompt bar */}
        <div className="gemini-ring rounded-2xl w-full max-w-2xl">
          <div className="rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl px-4 py-3.5">
            <input
              placeholder="Ask Ash anything"
              className="w-full bg-transparent outline-none text-[15px] placeholder:text-white/35"
            />
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-white/55">
                <IconBtn aria-label="Voice"><Mic className="h-4 w-4" /></IconBtn>
                <IconBtn aria-label="Add"><Plus className="h-4 w-4" /></IconBtn>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white/85"
              >
                <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--g-purple)" }} />
                I'm feeling lucky
              </button>
            </div>
          </div>
        </div>

        {/* Quick action pills */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {quickPills.map(({ icon: Icon, label, tint, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full",
                "bg-white/[0.05] hover:bg-white/[0.10] border border-white/10",
                "text-[12.5px] text-white/80 transition",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", tint)} />
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="h-8 w-8 rounded-full bg-white/[0.05] hover:bg-white/[0.10] border border-white/10 text-white/70 flex items-center justify-center"
            aria-label="More"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* Bottom-left dashboard */}
      <aside
        className={cn(
          "fixed z-10 pointer-events-none",
          "left-4 bottom-4 sm:left-6 sm:bottom-6",
          "w-[min(360px,calc(100vw-2rem))]",
        )}
      >
        <TodayPanel onOpenIdea={() => navigate("/")} />
      </aside>
    </main>
  );
};

const IconBtn = ({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/[0.08] hover:text-white transition"
    {...rest}
  >
    {children}
  </button>
);

const AshOrb = () => (
  <span
    aria-hidden
    className="relative inline-flex h-10 w-10 rounded-full overflow-hidden gemini-hue-cycle"
    style={{
      background:
        "conic-gradient(from 0deg, var(--g-blue), var(--g-purple), var(--g-red), var(--g-yellow), var(--g-blue))",
    }}
  >
    <span className="absolute inset-1 rounded-full bg-black/70" />
    <span
      className="absolute inset-2 rounded-full"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), transparent 55%)",
      }}
    />
  </span>
);

const Home = () => (
  <ProtectedRoute>
    <HomeInner />
  </ProtectedRoute>
);

export default Home;
