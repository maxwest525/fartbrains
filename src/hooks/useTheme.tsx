import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";
type Ctx = { theme: Theme; toggle: () => void; setTheme: (t: Theme) => void };

const STORAGE_KEY = "ash-theme-v1";
const ThemeCtx = createContext<Ctx | null>(null);

const getInitial = (): Theme => {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* ignore */ }
  return "dark";
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(getInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  const value = useMemo(() => ({ theme, toggle, setTheme }), [theme, toggle, setTheme]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
};

export const useTheme = (): Ctx => {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};

/** Compact pill toggle — matches Gemini glass aesthetic. */
export const ThemeToggle = ({ className }: { className?: string }) => {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "relative inline-flex h-9 w-[64px] items-center rounded-full",
        "bg-white/15 dark:bg-white/[0.08] backdrop-blur-[6px] backdrop-saturate-150",
        "border border-white/30 dark:border-white/15",
        "shadow-[0_4px_14px_-4px_rgba(0,0,0,0.25)]",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--g-focus-ring,hsl(var(--ring)))]",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-8 w-8 rounded-full flex items-center justify-center text-white",
          "transition-transform duration-300 ease-out",
          "shadow-[0_4px_12px_-2px_rgba(155,114,203,0.55)]",
          isDark ? "translate-x-[28px]" : "translate-x-0.5",
        )}
        style={{ background: "linear-gradient(135deg,#4285F4 0%,#9B72CB 55%,#D96570 100%)" }}
      >
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
    </button>
  );
};
