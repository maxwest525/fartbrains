import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronLeft, Send, Loader2, Trash2, Sparkles, MessageCirclePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Idea } from "@/hooks/useIdeas";

type ChatMsg = { id?: string; role: "user" | "assistant"; content: string; created_at?: string };

type Props = {
  idea: Idea;
  onClose: () => void;
};

const buildSystemContext = (idea: Idea): string => {
  const parts = [
    `You are Ash, helping the user think through one specific idea from their vault.`,
    `Stay focused on this idea. Be direct, warm, concise. Markdown ok.`,
    ``,
    `## The idea`,
    `Title: ${idea.title || "(untitled)"}`,
    idea.raw_note ? `\nUser's note:\n${idea.raw_note}` : "",
    idea.ai_summary ? `\nAI summary:\n${idea.ai_summary}` : "",
    idea.generated_prompt ? `\nGenerated prompt:\n${idea.generated_prompt}` : "",
    idea.extracted_text
      ? `\nExtracted context (truncated):\n${idea.extracted_text.slice(0, 3000)}`
      : "",
  ];
  return parts.filter(Boolean).join("\n");
};

const buildSuggestions = (idea: Idea): string[] => {
  const t = idea.title || "this idea";
  return [
    `Sharpen the core insight behind "${t}".`,
    `What are the 3 biggest risks or blind spots?`,
    `Give me 5 concrete next actions this week.`,
    `Rewrite this as a punchy one-line pitch.`,
  ];
};

const formatRelative = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const IdeaChatScreen = ({ idea, onClose }: Props) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);


  const suggestions = useMemo(() => buildSuggestions(idea), [idea]);

  const threadLabel = useMemo(() => {
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return { title: "New conversation", when: "" };
    const title = firstUser.content.trim().replace(/\s+/g, " ").slice(0, 60);
    const when = firstUser.created_at ? formatRelative(firstUser.created_at) : "";
    return {
      title: title + (firstUser.content.length > 60 ? "…" : ""),
      when,
    };
  }, [messages]);

  // Load history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("idea_chats")
        .select("id, role, content, created_at")
        .eq("idea_id", idea.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error(error);
      } else {
        setMessages(
          (data ?? [])
            .filter((r) => r.role === "user" || r.role === "assistant")
            .map((r) => ({
              id: r.id,
              role: r.role as "user" | "assistant",
              content: r.content,
              created_at: r.created_at,
            })),
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [idea.id]);

  // Autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, sending, composerOpen]);

  // Autofocus composer when opened
  useEffect(() => {
    if (composerOpen) inputRef.current?.focus();
  }, [composerOpen]);

  const persist = async (role: "user" | "assistant", content: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    await supabase.from("idea_chats").insert({
      idea_id: idea.id,
      user_id: uid,
      role,
      content,
    });
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setErrorText(null);
    setLastPrompt(trimmed);
    const nextUser: ChatMsg = { role: "user", content: trimmed };
    const history = [...messages, nextUser];
    setMessages(history);
    setSending(true);
    void persist("user", trimmed);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ash-chat`;
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: buildSystemContext(idea) },
            ...history.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        const msg =
          res.status === 429
            ? "Rate limit — try again in a moment."
            : res.status === 402
            ? "AI credits exhausted."
            : res.status === 401
            ? "You need to be signed in to chat."
            : "Asher couldn't respond. Check your connection and try again.";
        setErrorText(msg);
        console.error("ash-chat error", res.status, errText);
        setSending(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              acc += delta;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: acc };
                return copy;
              });
            }
          } catch {
            /* ignore */
          }
        }
      }
      if (acc.trim()) {
        void persist("assistant", acc);
      } else {
        // Stream ended with no content — surface a soft error.
        setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && m.role === "assistant" && !m.content)));
        setErrorText("Asher didn't return a response. Try again.");
      }
    } catch (e) {
      console.error(e);
      setErrorText("Network error — your message wasn't sent. Try again.");
    } finally {
      setSending(false);
    }
  };

  const retryLast = () => {
    if (!lastPrompt || sending) return;
    // Remove the trailing failed user message so we don't duplicate it.
    setMessages((prev) => {
      const copy = [...prev];
      if (copy.length && copy[copy.length - 1].role === "user" && copy[copy.length - 1].content === lastPrompt) {
        copy.pop();
      }
      return copy;
    });
    void sendText(lastPrompt);
  };


  const clearHistory = async () => {
    if (!confirm("Clear this idea's chat history?")) return;
    const { error } = await supabase.from("idea_chats").delete().eq("idea_id", idea.id);
    if (error) {
      toast.error("Could not clear history");
      return;
    }
    setMessages([]);
    toast.success("Chat history cleared");
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText(input);
    }
  };

  const handleSuggestion = (s: string) => {
    setComposerOpen(false);
    void sendText(s);
  };

  const isEmpty = !loading && messages.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/80 backdrop-blur-2xl anim-slide-in overflow-hidden">
      {/* Header */}
      <div className="safe-top shrink-0 px-3 py-1.5 flex items-center gap-2 border-b border-white/10 bg-background/50 backdrop-blur-xl">
        <button
          onClick={onClose}
          className="press flex items-center text-primary pl-1 pr-1.5 h-9 text-[15px]"
          aria-label="Back to idea"
        >
          <ChevronLeft className="h-5 w-5 -mr-0.5" strokeWidth={2.4} />
          <span className="font-normal">Idea</span>
        </button>
        <div className="flex-1 min-w-0 text-center px-1">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70 flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3 text-accent" />
            <span className="truncate max-w-[70%]">{idea.title || "Untitled idea"}</span>
          </div>
          {(threadLabel.title !== "New conversation" || threadLabel.when) && (
            <div className="text-[12px] font-medium truncate leading-tight mt-0.5">
              {threadLabel.title}
              {threadLabel.when && (
                <span className="text-muted-foreground/60 font-normal"> · {threadLabel.when}</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={clearHistory}
          className="press h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-destructive"
          aria-label="Clear chat history"
          title="Clear history"
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        className={`flex-1 min-h-0 ${isEmpty ? "overflow-hidden flex flex-col" : "overflow-y-auto"} px-3 sm:px-4 ${isEmpty ? "pt-3 pb-3" : "pt-2 sm:pt-4 pb-3"}`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : isEmpty ? (
          <div className="flex-1 min-h-0 flex flex-col items-center text-center max-w-md mx-auto w-full">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 border border-white/15 flex items-center justify-center mb-2 shadow-lg shadow-primary/10 shrink-0">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-[17px] font-semibold tracking-tight shrink-0">Brainstorm with Asher</h2>
            <p className="text-[12.5px] text-muted-foreground mt-1 px-2 leading-snug shrink-0">
              Pick a starting point, or start your own thread.
            </p>

            <div className="w-full mt-3 space-y-1.5 flex-1 min-h-0 flex flex-col justify-center">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="press w-full text-left text-[13.5px] leading-snug px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="shrink-0 pt-2 pb-1">
              <button
                onClick={() => setComposerOpen(true)}
                className="press inline-flex items-center gap-2 h-11 px-5 rounded-full brand-gradient text-white shadow-xl shadow-primary/30 text-[14px] font-medium"
              >
                <MessageCirclePlus className="h-[17px] w-[17px]" />
                Ask your own question
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-4">
            {messages.map((m, i) => (
              <div key={m.id ?? i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-1.5 sm:px-3.5 sm:py-2 text-[14px] sm:text-[15px] leading-snug sm:leading-normal whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[94%] text-foreground text-[14px] sm:text-[15px] leading-snug sm:leading-relaxed prose prose-sm prose-invert prose-p:my-1 sm:prose-p:my-2 prose-ul:my-1 sm:prose-ul:my-2 prose-li:my-0 max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || "…"}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
            {sending && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="text-muted-foreground text-sm inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Composer — always pinned to bottom once there's a conversation */}
      {!loading && !isEmpty && (
        <div className="safe-bottom shrink-0 sticky bottom-0 border-t border-white/10 bg-background/80 backdrop-blur-xl px-3 pt-2 pb-2.5">
          <div className="flex items-end gap-2 rounded-2xl bg-white/5 border border-white/10 px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask Asher about this idea…"
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none text-[15px] leading-snug max-h-40 py-1"
            />
            <button
              onClick={() => sendText(input)}
              disabled={!input.trim() || sending}
              className="press h-9 w-9 rounded-full brand-gradient flex items-center justify-center text-white disabled:opacity-40 shrink-0"
              aria-label="Send"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
