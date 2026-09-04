import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChatMessage = {
  id: string;
  idea_id: string;
  idea_title: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

/**
 * Saved Asher composer history (the "Brainstorm with Asher" threads stored per
 * idea). Newest first, capped so the dashboard stays fast.
 */
export function useChatHistory(limit = 300) {
  return useQuery({
    queryKey: ["chat-history", limit],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("idea_chats")
        .select("id, idea_id, role, content, created_at, ideas(title)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;

      type Row = {
        id: string;
        idea_id: string;
        role: string;
        content: string;
        created_at: string;
        ideas: { title: string } | { title: string }[] | null;
      };

      return ((data ?? []) as unknown as Row[]).map((r) => {
        const joined = Array.isArray(r.ideas) ? r.ideas[0] : r.ideas;
        return {
          id: r.id,
          idea_id: r.idea_id,
          idea_title: joined?.title ?? "Untitled idea",
          role: r.role === "assistant" ? "assistant" : "user",
          content: r.content,
          created_at: r.created_at,
        };
      });
    },
  });
}
