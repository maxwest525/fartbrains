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
    `Sharpen the core insight behind "${t}" in one paragraph.`,
    `What are the 3 biggest risks or blind spots here?`,
    `Give me 5 concrete next actions I can take this week.`,
    `Who is the ideal audience, and how would I reach them?`,
    `Rewrite this as a punchy one-line pitch.`,
    `What existing products or ideas is this most similar to?`,
  ];
};

export const IdeaChatScreen = ({ idea, onClose }: Props) => {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = useMemo(() => buildSuggestions(idea), [idea]);

  // Load history
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("idea_chats")
        .select("id, role, content")
        .eq("idea_id", idea.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error(error);
      } else {
        setMessages(
          (data ?? [])
            .filter((r) => r.role === "user" || r.role === "assistant")
            .map((r) => ({ id: r.id, role: r.role as "user" | "assistant", content: r.content })),
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
        if (res.status === 429) toast.error("Rate limit — try again in a moment.");
        else if (res.status === 402) toast.error("AI credits exhausted.");
        else toast.error("Chat failed");
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
      if (acc.trim()) void persist("assistant", acc);
    } catch (e) {
      console.error(e);
      toast.error("Chat failed");
    } finally {
      setSending(false);
    }
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
    <div className="fixed inset-0 z-50 flex flex-col bg-background/80 backdrop-blur-2xl anim-slide-in">
      {/* Header */}
      <div className="safe-top sticky top-0 z-10 px-3 py-2 flex items-center gap-3 border-b border-white/10 bg-background/50 backdrop-blur-xl min-h-[60px]">
        <button
          onClick={onClose}
          className="press flex items-center text-primary pl-1 pr-2 h-10 text-[17px]"
          aria-label="Back to idea"
        >
          <ChevronLeft className="h-6 w-6 -mr-0.5" strokeWidth={2.4} />
          <span className="font-normal">Idea</span>
        </button>
        <div className="flex-1 min-w-0 text-center px-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground/70 flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3 text-accent" /> Chat with this idea
          </div>
          <div className="text-sm font-medium truncate">{idea.title || "Untitled"}</div>
        </div>
        <button
          onClick={clearHistory}
          className="press h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-destructive"
          aria-label="Clear chat history"
          title="Clear history"
        >
          <Trash2 className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-5 pb-32 sm:pb-28">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : isEmpty ? (
          <div className="max-w-md mx-auto flex flex-col items-center text-center pt-4 pb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 border border-white/15 flex items-center justify-center mb-4 shadow-lg shadow-primary/10">
              <Sparkles className="h-6 w-6 text-accent" />
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Think this through with Ash</h2>
            <p className="text-sm text-muted-foreground mt-2 px-4 leading-relaxed">
              Pick a starting point below, or start your own thread when you're ready.
            </p>

            <div className="w-full mt-6 space-y-2.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSuggestion(s)}
                  className="press w-full text-left text-[14.5px] leading-relaxed px-4 py-3.5 rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={m.id ?? i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2 text-[15px] whitespace-pre-wrap break-words">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[92%] text-foreground text-[15px] leading-relaxed prose prose-sm prose-invert prose-p:my-2 prose-ul:my-2 prose-li:my-0 max-w-none">
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

      {/* Floating "Ask your own" button (when composer is hidden) */}
      {!composerOpen && !loading && (
        <div className="safe-bottom absolute bottom-0 left-0 right-0 px-4 pb-5 pointer-events-none">
          <div className="flex justify-center pointer-events-auto">
            <button
              onClick={() => setComposerOpen(true)}
              className="press inline-flex items-center gap-2 h-12 px-6 rounded-full brand-gradient text-white shadow-xl shadow-primary/30 text-[15px] font-medium"
            >
              <MessageCirclePlus className="h-[18px] w-[18px]" />
              {isEmpty ? "Ask your own question" : "Continue the conversation"}
            </button>
          </div>
        </div>
      )}

      {/* Composer (only when opened) */}
      {composerOpen && (
        <div className="safe-bottom border-t border-white/10 bg-background/70 backdrop-blur-xl px-3 pt-2.5 pb-3 anim-slide-in">
          <div className="flex items-end gap-2 rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5">
            <button
              onClick={() => setComposerOpen(false)}
              className="press h-9 w-9 flex items-center justify-center text-muted-foreground shrink-0"
              aria-label="Close composer"
            >
              <X className="h-4 w-4" />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Ask about this idea…"
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
