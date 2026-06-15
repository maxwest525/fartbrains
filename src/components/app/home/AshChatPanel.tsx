import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2, Square, RotateCcw, Link as LinkIcon, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useAshChat } from "@/hooks/useAshChat";
import { useSaveAshToIdea } from "@/hooks/useSaveAshToIdea";
import { AshMessageActions } from "@/components/app/home/AshMessageActions";
import { toast } from "sonner";

export type AshChatHandle = {
  send: (text: string) => void;
};

type Props = {
  onSaved?: (ideaId: string) => void;
  onOpenUrlCapture: (url: string) => void;
  onOpenTranscriptCapture: (text: string) => void;
  /** Fires once each time the assistant finishes streaming a reply. */
  onAssistantReply?: (text: string) => void;
};

const URL_RE = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/i;

/**
 * Ash chat thread merged into `/`. Streams replies, lets the user save any
 * exchange to the Idea Vault, and auto-detects URL / long-text input to route
 * into the proper capture sheet instead of chatting.
 */
export const AshChatPanel = forwardRef<AshChatHandle, Props>(function AshChatPanel(
  { onSaved, onOpenUrlCapture, onOpenTranscriptCapture, onAssistantReply },
  ref,
) {
  const { messages, streaming, error, send, stop, reset, regenerate } = useAshChat();
  const { save, saving } = useSaveAshToIdea();
  const [input, setInput] = useState("");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevStreamingRef = useRef(false);

  // Auto-scroll to bottom as messages stream.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Fire onAssistantReply once when streaming transitions from true -> false.
  useEffect(() => {
    if (prevStreamingRef.current && !streaming) {
      const last = messages[messages.length - 1];
      if (last?.role === "assistant" && last.content.trim()) {
        onAssistantReply?.(last.content);
      }
    }
    prevStreamingRef.current = streaming;
  }, [streaming, messages, onAssistantReply]);

  // Imperative handle so the orb can push a transcript straight into chat.
  useImperativeHandle(ref, () => ({
    send: (text: string) => {
      const t = text.trim();
      if (!t) return;
      void send(t);
    },
  }), [send]);

  // Keep composer focused unless something else legitimately owns focus.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-grow up to 2 lines (~72px), then scroll inside.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 72) + "px";
  }, [input]);


  const detected = useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const m = trimmed.match(URL_RE);
    if (m) return { kind: "url" as const, value: m[0] };
    if (trimmed.length >= 400 || trimmed.split("\n").length >= 4) {
      return { kind: "transcript" as const, value: trimmed };
    }
    return null;
  }, [input]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || streaming) return;
    if (detected?.kind === "url") {
      onOpenUrlCapture(detected.value);
      setInput("");
      return;
    }
    if (detected?.kind === "transcript") {
      onOpenTranscriptCapture(detected.value);
      setInput("");
      return;
    }
    setInput("");
    void send(text);
  };

  const handleSave = async (idx: number) => {
    const assistant = messages[idx];
    const user = messages[idx - 1];
    if (!assistant || assistant.role !== "assistant") return;
    setSavingIdx(idx);
    try {
      const idea = await save({
        userPrompt: user?.content ?? "",
        assistantReply: assistant.content,
      });
      if (idea) onSaved?.(idea.id);
    } finally {
      setSavingIdx(null);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied"),
      () => toast.error("Couldn't copy"),
    );
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0 rounded-2xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="text-[13px] font-semibold">Ash</div>
          {streaming && (
            <span className="text-[11.5px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> thinking
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition"
            title="New chat"
          >
            <RotateCcw className="h-3 w-3" />
            New
          </button>
        )}
      </div>

      {/* Thread */}
      <div
        ref={threadRef}
        className="flex-1 min-h-0 overflow-y-auto scroll-momentum touch-pan-y px-4 py-4 space-y-4"
      >
        {isEmpty ? (
          <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center gap-3 px-6">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-[14px] font-semibold">Ask Ash anything</div>
              <p className="text-[12.5px] text-muted-foreground mt-0.5 max-w-sm">
                Paste a link to capture it, paste a transcript to summarize, or just chat. Save any reply to your vault.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
              <SuggestionChip onClick={() => setInput("https://")}>
                <LinkIcon className="h-3 w-3" /> Capture a URL
              </SuggestionChip>
              <SuggestionChip onClick={() => onOpenTranscriptCapture("")}>
                <FileText className="h-3 w-3" /> Paste transcript
              </SuggestionChip>
              <SuggestionChip onClick={() => setInput("Summarize my latest thinking on ")}>
                <Sparkles className="h-3 w-3" /> Brainstorm
              </SuggestionChip>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground",
                )}
              >
                {m.content || (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> …
                  </span>
                )}
                {m.role === "assistant" && m.content && !streaming && (
                  <AshMessageActions
                    onSave={() => handleSave(i)}
                    onCopy={() => handleCopy(m.content)}
                    onRegenerate={i === messages.length - 1 ? regenerate : undefined}
                    saving={saving && savingIdx === i}
                  />
                )}
              </div>
            </div>
          ))
        )}
        {error && (
          <div className="text-[12.5px] text-destructive px-1">{error}</div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/60 p-2.5">
        {detected && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-lg bg-primary/10 border border-primary/20 text-[12px] text-foreground">
            {detected.kind === "url" ? <LinkIcon className="h-3.5 w-3.5 text-primary" /> : <FileText className="h-3.5 w-3.5 text-primary" />}
            <span className="flex-1 truncate">
              {detected.kind === "url" ? "Detected a URL — press send to capture it" : "Long text detected — press send to save as transcript"}
            </span>
          </div>
        )}
        <div className="relative">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Message Ash, paste a URL, or drop a transcript…"
            rows={2}
            className="resize-none min-h-[68px] max-h-[72px] overflow-y-auto rounded-xl pr-12 text-[14px] bg-background"
          />
          <button
            type="button"
            onClick={streaming ? stop : handleSubmit}
            disabled={!streaming && !input.trim()}
            className={cn(
              "absolute right-1.5 bottom-1.5 h-8 w-8 rounded-lg flex items-center justify-center transition",
              streaming
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90",
            )}
            aria-label={streaming ? "Stop" : "Send"}
          >
            {streaming ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
});

const SuggestionChip = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-medium border border-border bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition"
  >
    {children}
  </button>
);
