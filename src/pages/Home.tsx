import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Mail,
  Calendar as CalendarIcon,
  AlertTriangle,
  BarChart3,
  Mic,
  Plus,
  ArrowUp,
  Square,
  RotateCcw,
  Loader2,
  Link as LinkIcon,
  FileText,
} from "lucide-react";
import { TodayPanel } from "@/components/app/home/TodayPanel";
import { AshMessageActions } from "@/components/app/home/AshMessageActions";
import { TranscriptCaptureScreen } from "@/components/app/TranscriptCaptureScreen";
import { UrlCaptureScreen } from "@/components/app/UrlCaptureScreen";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAshChat } from "@/hooks/useAshChat";
import { useSaveAshToIdea } from "@/hooks/useSaveAshToIdea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Capture =
  | { kind: "url"; url?: string }
  | { kind: "transcript"; text?: string }
  | null;

const looksLikeUrl = (s: string): string | null => {
  const t = s.trim();
  if (!t || /\s/.test(t)) return null;
  if (!/^https?:\/\//i.test(t) && !/^[\w-]+\.[\w.-]+/.test(t)) return null;
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
};

const looksLikeTranscript = (s: string) =>
  s.trim().length >= 400 || (s.match(/\n/g)?.length ?? 0) >= 3;

const HomeInner = () => {
  const navigate = useNavigate();
  const { messages, streaming, error, send, stop, reset, regenerate } = useAshChat();
  const { save: saveAsh, saving: savingAsh } = useSaveAshToIdea();
  const [input, setInput] = useState("");
  const [capture, setCapture] = useState<Capture>(null);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const inputUrl = useMemo(() => looksLikeUrl(input), [input]);
  const inputIsTranscript = !inputUrl && looksLikeTranscript(input);

  const submit = () => {
    const t = input.trim();
    if (!t || streaming) return;
    // URL → route into URL capture instead of chat
    if (inputUrl) {
      setCapture({ kind: "url", url: inputUrl });
      setInput("");
      return;
    }
    setInput("");
    void send(t);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleSaveMessage = async (assistantIdx: number) => {
    const userMsg = messages[assistantIdx - 1];
    const reply = messages[assistantIdx];
    if (!reply || reply.role !== "assistant") return;
    setSavingIdx(assistantIdx);
    try {
      await saveAsh({
        userPrompt: userMsg?.role === "user" ? userMsg.content : "",
        assistantReply: reply.content,
      });
    } finally {
      setSavingIdx(null);
    }
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Copied"))
      .catch(() => toast.error("Couldn't copy"));
  };

  const hasThread = messages.length > 0;

  const quickPills = [
    {
      icon: LinkIcon,
      label: "Capture link",
      tint: "text-cyan-300",
      onClick: () => setCapture({ kind: "url" }),
    },
    {
      icon: FileText,
      label: "Paste transcript",
      tint: "text-violet-300",
      onClick: () => setCapture({ kind: "transcript" }),
    },
    {
      icon: CalendarIcon,
      label: "Today's calendar",
      tint: "text-emerald-300",
      onClick: () => navigate("/?view=calendar"),
    },
    { icon: Mail, label: "Overnight inbox", tint: "text-rose-300" },
    { icon: BarChart3, label: "Pipeline review", tint: "text-blue-300" },
    { icon: AlertTriangle, label: "Alerts", tint: "text-amber-300" },
  ];

  return (
    <main className="gemini relative min-h-dvh w-full overflow-hidden bg-[color:var(--g-surface-0)] text-white">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(800px 500px at 50% 28%, rgba(155,114,203,0.18), transparent 60%), radial-gradient(900px 600px at 80% 90%, rgba(66,133,244,0.12), transparent 65%)",
        }}
      />

      <section
        className={cn(
          "relative z-10 mx-auto max-w-3xl px-6 pb-10 flex flex-col items-center text-center transition-all",
          hasThread ? "pt-[6vh]" : "pt-[14vh]",
        )}
      >
        <div className="flex items-center gap-3 mb-7">
          <h1 className="text-[28px] sm:text-[34px] font-semibold tracking-tight">
            {hasThread ? "Ash" : "What can Ash do for you today?"}
          </h1>
          <AshOrb spinning={streaming} />
        </div>

        {hasThread && (
          <div
            ref={scrollerRef}
            className="w-full max-w-2xl mb-4 max-h-[52vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 text-left space-y-4"
          >
            {messages.map((m, i) => {
              const isLastAssistant =
                m.role === "assistant" && i === messages.length - 1;
              const showActions =
                m.role === "assistant" && m.content && !(streaming && isLastAssistant);
              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col",
                    m.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-white/[0.10] border border-white/10 text-white"
                        : "bg-transparent text-white/90",
                    )}
                  >
                    {m.content ||
                      (streaming && isLastAssistant ? (
                        <Loader2 className="h-4 w-4 animate-spin text-white/60" />
                      ) : null)}
                  </div>
                  {showActions && (
                    <AshMessageActions
                      onSave={() => handleSaveMessage(i)}
                      onCopy={() => handleCopy(m.content)}
                      onRegenerate={isLastAssistant ? regenerate : undefined}
                      saving={savingAsh && savingIdx === i}
                    />
                  )}
                </div>
              );
            })}
            {error && (
              <div className="text-[12.5px] text-rose-300/90 border border-rose-400/20 bg-rose-500/10 rounded-xl px-3 py-2">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Prompt bar */}
        <div className="gemini-ring rounded-2xl w-full max-w-2xl">
          <div className="rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl px-4 py-3.5">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={1}
              placeholder="Ask Ash, paste a link, or drop a transcript"
              className="w-full bg-transparent outline-none text-[15px] placeholder:text-white/35 resize-none max-h-40"
            />

            {/* Smart-route hints */}
            {(inputUrl || inputIsTranscript) && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {inputUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCapture({ kind: "url", url: inputUrl });
                      setInput("");
                    }}
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium bg-cyan-400/15 hover:bg-cyan-400/25 border border-cyan-400/30 text-cyan-100"
                  >
                    <LinkIcon className="h-3.5 w-3.5" />
                    Capture this link → folder
                  </button>
                )}
                {inputIsTranscript && (
                  <button
                    type="button"
                    onClick={() => {
                      setCapture({ kind: "transcript", text: input });
                      setInput("");
                    }}
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[12px] font-medium bg-violet-400/15 hover:bg-violet-400/25 border border-violet-400/30 text-violet-100"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Looks like a transcript — save it
                  </button>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-white/55">
                <IconBtn aria-label="Voice">
                  <Mic className="h-4 w-4" />
                </IconBtn>
                <IconBtn aria-label="Capture link" onClick={() => setCapture({ kind: "url" })}>
                  <LinkIcon className="h-4 w-4" />
                </IconBtn>
                <IconBtn aria-label="Paste transcript" onClick={() => setCapture({ kind: "transcript" })}>
                  <FileText className="h-4 w-4" />
                </IconBtn>
                {hasThread && (
                  <IconBtn aria-label="New chat" onClick={reset}>
                    <RotateCcw className="h-4 w-4" />
                  </IconBtn>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!hasThread && (
                  <button
                    type="button"
                    onClick={() => {
                      setInput("Surprise me with one useful idea I can act on today.");
                    }}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-white/85"
                  >
                    <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--g-purple)" }} />
                    I'm feeling lucky
                  </button>
                )}
                <button
                  type="button"
                  onClick={streaming ? stop : submit}
                  disabled={!streaming && !input.trim()}
                  className={cn(
                    "inline-flex items-center justify-center h-8 w-8 rounded-full transition",
                    streaming
                      ? "bg-white/[0.14] hover:bg-white/[0.20] text-white"
                      : input.trim()
                        ? "bg-white text-black hover:bg-white/90"
                        : "bg-white/[0.08] text-white/40 border border-white/10 cursor-not-allowed",
                  )}
                  aria-label={streaming ? "Stop" : "Send"}
                >
                  {streaming ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {!hasThread && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {quickPills.map(({ icon: Icon, label, tint, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick ?? (() => setInput(label))}
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
          </div>
        )}
      </section>

      <aside
        className={cn(
          "fixed z-10 pointer-events-none",
          "left-4 bottom-4 sm:left-6 sm:bottom-6",
          "w-[min(360px,calc(100vw-2rem))]",
        )}
      >
        <TodayPanel onOpenIdea={() => navigate("/")} />
      </aside>

      {capture?.kind === "url" && (
        <UrlCaptureScreen
          defaultUrl={capture.url}
          onBack={() => setCapture(null)}
          onCreated={(id, needsReview) => {
            if (needsReview) navigate(`/?ideaId=${id}`);
          }}
        />
      )}
      {capture?.kind === "transcript" && (
        <TranscriptPrefilled
          text={capture.text}
          onBack={() => setCapture(null)}
          onCreated={(id, needsReview) => {
            if (needsReview) navigate(`/?ideaId=${id}`);
          }}
        />
      )}
    </main>
  );
};

/**
 * TranscriptCaptureScreen doesn't accept a prefilled note prop; this thin
 * wrapper renders it and (when prefill text is provided) sets it through a
 * stable DOM-level effect via the screen's existing focus pattern.
 *
 * To avoid changing TranscriptCaptureScreen's API, we render it then write to
 * its textarea once mounted.
 */
const TranscriptPrefilled = ({
  text,
  onBack,
  onCreated,
}: {
  text?: string;
  onBack: () => void;
  onCreated?: (id: string, needsReview?: boolean) => void;
}) => {
  useEffect(() => {
    if (!text) return;
    const id = requestAnimationFrame(() => {
      const ta = document.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder^="Paste a transcript"]',
      );
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        )?.set;
        setter?.call(ta, text);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [text]);

  return <TranscriptCaptureScreen onBack={onBack} onCreated={onCreated} />;
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

const AshOrb = ({ spinning = false }: { spinning?: boolean }) => (
  <span
    aria-hidden
    className={cn(
      "relative inline-flex h-10 w-10 rounded-full overflow-hidden gemini-hue-cycle",
      spinning && "animate-spin",
    )}
    style={{
      background:
        "conic-gradient(from 0deg, var(--g-blue), var(--g-purple), var(--g-red), var(--g-yellow), var(--g-blue))",
      animationDuration: spinning ? "2.5s" : undefined,
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
