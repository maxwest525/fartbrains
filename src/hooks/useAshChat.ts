import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AshMessage = { role: "user" | "assistant"; content: string };

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ash-chat`;

/**
 * Streaming chat against the ash-chat edge function. Single-thread, in-memory.
 * Reads SSE deltas and appends to the live assistant message.
 */
export function useAshChat() {
  const [messages, setMessages] = useState<AshMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || streaming) return;
      setError(null);

      const nextHistory: AshMessage[] = [
        ...messages,
        { role: "user", content: prompt },
        { role: "assistant", content: "" },
      ];
      setMessages(nextHistory);
      setStreaming(true);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const { data: sess } = await supabase.auth.getSession();
        const token =
          sess.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const resp = await fetch(FN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          signal: ctrl.signal,
          body: JSON.stringify({
            messages: nextHistory
              .slice(0, -1) // drop empty assistant placeholder
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (!resp.ok || !resp.body) {
          const body = await resp.text().catch(() => "");
          throw new Error(body || `Request failed (${resp.status})`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buf.indexOf("\n")) !== -1) {
            const rawLine = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);
            if (!rawLine.startsWith("data:")) continue;
            const data = rawLine.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta: string = json?.choices?.[0]?.delta?.content ?? "";
              if (!delta) continue;
              setMessages((prev) => {
                const copy = prev.slice();
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") {
                  copy[copy.length - 1] = { ...last, content: last.content + delta };
                }
                return copy;
              });
            } catch {
              // ignore malformed chunk
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          const msg = e instanceof Error ? e.message : "Something went wrong";
          setError(msg);
          setMessages((prev) => {
            const copy = prev.slice();
            const last = copy[copy.length - 1];
            if (last?.role === "assistant" && !last.content) copy.pop();
            return copy;
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
  }, []);

  return { messages, streaming, error, send, stop, reset };
}
