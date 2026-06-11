import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TodayReminder = {
  id: string;
  title: string;
  remind_at: string;
  source: "idea" | "folder";
};

export type TodayIdea = {
  id: string;
  title: string;
  created_at: string;
};

/**
 * Combined dashboard feed for the Ash home screen.
 * Pulls reminders firing today (idea + folder reminders) and the 5 most
 * recently captured ideas. Refetched every 60s and on focus.
 */
export function useTodayFeed() {
  return useQuery({
    queryKey: ["today-feed"],
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);

      const [ideaRem, ideas, folders] = await Promise.all([
        supabase
          .from("idea_reminders" as never)
          .select("id, remind_at, idea_id")
          .gte("remind_at", start.toISOString())
          .lte("remind_at", end.toISOString())
          .is("fired_at", null)
          .order("remind_at", { ascending: true }),
        supabase
          .from("ideas")
          .select("id, title, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("folders")
          .select("id, name, remind_at, reminder_fired_at" as never)
          .not("remind_at" as never, "is", null)
          .gte("remind_at" as never, start.toISOString())
          .lte("remind_at" as never, end.toISOString())
          .is("reminder_fired_at" as never, null),
      ]);

      // Resolve idea titles for idea-reminders.
      const ideaIds = ((ideaRem.data ?? []) as Array<{ idea_id: string }>).map(
        (r) => r.idea_id,
      );
      let ideaTitles: Record<string, string> = {};
      if (ideaIds.length) {
        const { data } = await supabase
          .from("ideas")
          .select("id, title")
          .in("id", ideaIds);
        ideaTitles = Object.fromEntries(
          (data ?? []).map((i: { id: string; title: string }) => [i.id, i.title]),
        );
      }

      const reminders: TodayReminder[] = [
        ...((ideaRem.data ?? []) as Array<{
          id: string;
          remind_at: string;
          idea_id: string;
        }>).map((r) => ({
          id: r.id,
          title: ideaTitles[r.idea_id] ?? "Idea reminder",
          remind_at: r.remind_at,
          source: "idea" as const,
        })),
        ...((folders.data ?? []) as Array<{
          id: string;
          name: string;
          remind_at: string;
        }>).map((f) => ({
          id: f.id,
          title: f.name,
          remind_at: f.remind_at,
          source: "folder" as const,
        })),
      ].sort((a, b) => a.remind_at.localeCompare(b.remind_at));

      return {
        reminders,
        recentIdeas: ((ideas.data ?? []) as TodayIdea[]) ?? [],
      };
    },
  });
}
