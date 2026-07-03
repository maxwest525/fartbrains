import { useEffect, useState } from "react";
import { Download, X, Monitor, Share, Plus as PlusIcon } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Browser = "chrome-edge" | "safari" | "firefox" | "other";

const detectBrowser = (): Browser => {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "chrome-edge";
  if (/Chrome\//.test(ua) && !/OPR|Brave/.test(ua)) return "chrome-edge";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "safari";
  if (/Firefox\//.test(ua)) return "firefox";
  return "other";
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  // @ts-expect-error iOS Safari
  window.navigator.standalone === true;

const DISMISS_KEY = "install-prompt-dismissed-v1";

export const InstallAppPrompt = () => {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") {
      // still allow manual button
      setVisible(true);
      return;
    }
    setVisible(true);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    const onInstalled = () => {
      setDeferred(null);
      setVisible(false);
      setOpen(false);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleClick = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const { outcome } = await deferred.userChoice;
        if (outcome === "accepted") {
          setDeferred(null);
          setVisible(false);
          return;
        }
      } catch { /* ignore */ }
    }
    setOpen(true);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  if (!visible) return null;

  const browser = detectBrowser();

  return (
    <>
      <button
        onClick={handleClick}
        title="Install Fart Brains as a desktop app"
        className="fixed z-[90] bottom-4 right-4 hidden [html.desktop-expanded_&]:inline-flex md:inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium text-white bg-gradient-to-br from-fuchsia-500/80 via-violet-500/80 to-cyan-500/80 shadow-[0_0_24px_rgba(168,85,247,0.45)] border border-white/15 backdrop-blur-xl hover:scale-[1.03] active:scale-[0.97] transition"
      >
        <Download className="h-4 w-4" />
        Install app
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b12]/95 shadow-2xl overflow-hidden"
          >
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-fuchsia-500/10 via-transparent to-cyan-500/10" />
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 h-8 w-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-500 flex items-center justify-center shadow-lg">
                  <Monitor className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-semibold tracking-tight">Install Fart Brains</h2>
                  <p className="text-white/60 text-xs">Runs in its own window with an app icon</p>
                </div>
              </div>

              {browser === "chrome-edge" && (
                <ol className="space-y-3 text-sm text-white/80">
                  <Step n={1}>Look at the right side of the address bar.</Step>
                  <Step n={2}>
                    Click the <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-white text-xs"><Monitor className="h-3 w-3" /> install</span> icon
                    (a small monitor with a down arrow).
                  </Step>
                  <Step n={3}>Click <b className="text-white">Install</b> in the popup.</Step>
                  <p className="text-white/50 text-xs pt-1">
                    Don't see it? Open the browser menu (⋮) → <b>Cast, save, and share</b> → <b>Install Fart Brains</b>.
                  </p>
                </ol>
              )}

              {browser === "safari" && (
                <ol className="space-y-3 text-sm text-white/80">
                  <Step n={1}>
                    Click <b className="text-white">File</b> in the menu bar (or the <Share className="inline h-3.5 w-3.5 -mt-0.5" /> Share button).
                  </Step>
                  <Step n={2}>Choose <b className="text-white">Add to Dock…</b></Step>
                  <Step n={3}>Confirm the name and click <b className="text-white">Add</b>.</Step>
                  <p className="text-white/50 text-xs pt-1">Requires macOS Sonoma (14) or later.</p>
                </ol>
              )}

              {browser === "firefox" && (
                <div className="text-sm text-white/80 space-y-2">
                  <p>Firefox on desktop doesn't support installing web apps directly.</p>
                  <p className="text-white/60">
                    To install Fart Brains as a desktop app, open this site in <b className="text-white">Chrome</b>, <b className="text-white">Edge</b>, or <b className="text-white">Safari</b> and try again.
                  </p>
                </div>
              )}

              {browser === "other" && (
                <ol className="space-y-3 text-sm text-white/80">
                  <Step n={1}>Open the browser menu.</Step>
                  <Step n={2}>Look for <b className="text-white">Install app</b>, <b className="text-white">Add to Home screen</b>, or <b className="text-white">Create shortcut</b>.</Step>
                  <Step n={3}>Confirm to install.</Step>
                </ol>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  onClick={dismiss}
                  className="text-xs text-white/50 hover:text-white/80 transition"
                >
                  Don't show again
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="h-9 px-4 rounded-full text-sm font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex gap-3">
    <span className="shrink-0 h-6 w-6 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-500 text-white text-xs font-semibold flex items-center justify-center">
      {n}
    </span>
    <span className="pt-0.5">{children}</span>
  </li>
);

// suppress unused import warning for PlusIcon (kept for potential future use)
void PlusIcon;
