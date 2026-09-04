import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, CalendarDays, CheckSquare, Download, Lightbulb, MessageSquare, NotebookPen, Search,
} from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { cn } from "@/lib/utils";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";
import { useTodos, type Todo } from "@/hooks/useTodos";
import { useIdeas, type Idea } from "@/hooks/useIdeas";
import { useChatHistory, type ChatMessage } from "@/hooks/useChatHistory";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import type { CalendarEvent } from "@/lib/calendarEvents";

type TabKey = "ideas" | "todos" | "jots" | "calendar" | "chats";

const TABS: ReadonlyArray<{ key: TabKey; label: string; icon: typeof CheckSquare }> = [
  { key: "ideas", label: "Ideas", icon: Lightbulb },
  { key: "todos", label: "To-dos", icon: CheckSquare },
  { key: "jots", label: "Jots", icon: NotebookPen },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "chats", label: "Composer history", icon: MessageSquare },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });

const matches = (query: string, ...fields: Array<string | null | undefined>) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
};

const DashboardInner = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("ideas");
  const [query, setQuery] = useState("");

  const { data: todos = [], isLoading: todosLoading } = useTodos();
  const { data: allIdeas = [], isLoading: ideasLoading } = useIdeas({ kind: "all" });
  const { data: chats = [], isLoading: chatsLoading } = useChatHistory();
  const { data: events = [], isLoading: eventsLoading } = useCalendarEvents();

  // The dashboard is the one full-width surface in an otherwise phone-framed app.
  useEffect(() => {
    document.documentElement.classList.add("route-wide");
    return () => document.documentElement.classList.remove("route-wide");
  }, []);

  const jots = useMemo(
    () => allIdeas.filter((i) => i.source_type === "manual"),
    [allIdeas],
  );

  const ideaMatches = (i: Idea) =>
    matches(query, i.title, i.raw_note, i.ai_summary, i.tags.join(" "));

  const filteredIdeas = useMemo(
    () => allIdeas.filter(ideaMatches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allIdeas, query],
  );
  const filteredTodos = useMemo(
    () => todos.filter((t) => matches(query, t.title)),
    [todos, query],
  );
  const filteredJots = useMemo(
    () => jots.filter(ideaMatches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [jots, query],
  );
  const filteredEvents = useMemo(
    () => events.filter((e) => matches(query, e.name, e.notes, e.event_type)),
    [events, query],
  );
  const filteredChats = useMemo(
    () => chats.filter((c) => matches(query, c.content, c.idea_title)),
    [chats, query],
  );

  const openTodos = todos.filter((t) => !t.done).length;

  const ideaColumns = [
    { header: "Title", value: (i: Idea) => i.title },
    { header: "Source", value: (i: Idea) => i.source_type },
    { header: "Note", value: (i: Idea) => i.raw_note ?? "" },
    { header: "Summary", value: (i: Idea) => i.ai_summary ?? "" },
    { header: "Tags", value: (i: Idea) => i.tags.join("; ") },
    { header: "Priority", value: (i: Idea) => i.priority },
    { header: "Favorite", value: (i: Idea) => (i.is_favorite ? "yes" : "no") },
    { header: "Created at", value: (i: Idea) => i.created_at },
    { header: "Updated at", value: (i: Idea) => i.updated_at },
  ];

  const exportIdeas = () =>
    downloadCsv(csvFilename("ideas"), toCsv<Idea>(filteredIdeas, ideaColumns));

  const exportTodos = () =>
    downloadCsv(
      csvFilename("todos"),
      toCsv<Todo>(filteredTodos, [
        { header: "Title", value: (t) => t.title },
        { header: "Status", value: (t) => (t.done ? "done" : "open") },
        { header: "Due", value: (t) => t.due_at ?? "" },
        { header: "Completed at", value: (t) => t.completed_at ?? "" },
        { header: "Created at", value: (t) => t.created_at },
      ]),
    );

  const exportJots = () =>
    downloadCsv(csvFilename("jots"), toCsv<Idea>(filteredJots, ideaColumns));

  const exportEvents = () =>
    downloadCsv(
      csvFilename("calendar"),
      toCsv<CalendarEvent>(filteredEvents, [
        { header: "Name", value: (e) => e.name },
        { header: "Type", value: (e) => e.event_type },
        { header: "Month", value: (e) => (e.month ? String(e.month) : "") },
        { header: "Day", value: (e) => (e.day ? String(e.day) : "") },
        { header: "Birth year", value: (e) => (e.birth_year ? String(e.birth_year) : "") },
        { header: "Notes", value: (e) => e.notes ?? "" },
        { header: "Created at", value: (e) => e.created_at },
      ]),
    );

  const exportChats = () =>
    downloadCsv(
      csvFilename("composer-history"),
      toCsv<ChatMessage>(filteredChats, [
        { header: "Idea", value: (c) => c.idea_title },
        { header: "Role", value: (c) => c.role },
        { header: "Message", value: (c) => c.content },
        { header: "Created at", value: (c) => c.created_at },
      ]),
    );

  const active = {
    ideas: { count: filteredIdeas.length, loading: ideasLoading, onExport: exportIdeas },
    todos: { count: filteredTodos.length, loading: todosLoading, onExport: exportTodos },
    jots: { count: filteredJots.length, loading: ideasLoading, onExport: exportJots },
    calendar: { count: filteredEvents.length, loading: eventsLoading, onExport: exportEvents },
    chats: { count: filteredChats.length, loading: chatsLoading, onExport: exportChats },
  }[tab];

  const exportAll = () => {
    exportIdeas();
    exportTodos();
    exportJots();
    exportEvents();
    exportChats();
  };

  return (
    <div className="min-h-dvh w-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-5 pt-6 pb-16">
        <header className="mb-5">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-foreground/80 hover:text-foreground transition mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Everything you have captured, in one place. Export any view as CSV.
              </p>
            </div>
            <button
              onClick={exportAll}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-primary/45 text-primary text-sm font-medium hover:bg-primary/10 transition"
            >
              <Download className="h-4 w-4" />
              Export everything
            </button>
          </div>
        </header>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          <SummaryTile icon={Lightbulb} label="Ideas" value={`${allIdeas.length}`} hint="everything captured" />
          <SummaryTile
            icon={CheckSquare}
            label="To-dos"
            value={`${openTodos} open`}
            hint={`${todos.length} total`}
          />
          <SummaryTile icon={NotebookPen} label="Jots" value={`${jots.length}`} hint="typed notes" />
          <SummaryTile icon={CalendarDays} label="Calendar" value={`${events.length}`} hint="saved events" />
          <SummaryTile
            icon={MessageSquare}
            label="Composer messages"
            value={`${chats.length}`}
            hint="saved Asher threads"
          />
        </div>


        {/* Tabs + search + export */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div role="tablist" aria-label="Dashboard sections" className="flex flex-wrap gap-1.5">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm transition border",
                  tab === key
                    ? "border-primary/50 text-primary bg-primary/10"
                    : "border-white/12 text-foreground/75 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this view…"
              aria-label="Search dashboard"
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/[0.06] border border-white/12 text-sm outline-none focus:border-primary/60"
            />
          </div>

          <button
            onClick={active.onExport}
            disabled={active.count === 0}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-primary/45 text-primary text-sm font-medium hover:bg-primary/10 transition disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        <section className="rounded-2xl glass-card overflow-hidden" aria-live="polite">
          {active.loading && (
            <div className="p-4 space-y-2.5" aria-busy="true" aria-label="Loading">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-11 rounded-xl bg-white/10 animate-pulse" />
              ))}
            </div>
          )}

          {!active.loading && active.count === 0 && (
            <div role="status" className="px-5 py-12 text-center">
              <p className="text-sm font-medium">Nothing here yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {query ? "No matches for your search." : "Capture something and it shows up here."}
              </p>
            </div>
          )}

          {!active.loading && active.count > 0 && tab === "ideas" && (
            <ul role="list" className="divide-y divide-white/10">
              {filteredIdeas.map((i) => (
                <li key={i.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <Link to="/" className="text-sm font-medium hover:underline break-words">
                        {i.title}
                      </Link>
                      {(i.raw_note || i.ai_summary) && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {i.ai_summary ?? i.raw_note}
                        </p>
                      )}
                      <p className="text-[11px] text-foreground/55 mt-1.5">
                        {i.source_type}
                        {i.tags.length > 0 && (
                          <span className="text-primary/85"> · {i.tags.map((t) => `#${t}`).join(" ")}</span>
                        )}
                      </p>
                    </div>
                    <time className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDate(i.created_at)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!active.loading && active.count > 0 && tab === "calendar" && (
            <ul role="list" className="divide-y divide-white/10">
              {filteredEvents.map((e) => (
                <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 shrink-0 text-[11px] px-2 py-0.5 rounded-full border border-white/20 text-foreground/70">
                    {e.month && e.day ? `${e.month}/${e.day}` : e.event_type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium break-words">
                      {e.emoji ? `${e.emoji} ` : ""}
                      {e.name}
                    </p>
                    {e.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.notes}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {e.event_type.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!active.loading && active.count > 0 && tab === "todos" && (
            <ul role="list" className="divide-y divide-white/10">
              {filteredTodos.map((t) => (
                <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 text-[11px] px-2 py-0.5 rounded-full border",
                      t.done
                        ? "border-primary/50 text-primary"
                        : "border-white/20 text-foreground/70",
                    )}
                  >
                    {t.done ? "Done" : "Open"}
                  </span>
                  <span
                    className={cn(
                      "flex-1 text-sm leading-snug break-words",
                      t.done && "line-through text-foreground/50",
                    )}
                  >
                    {t.title}
                  </span>
                  <time className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {formatDate(t.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          )}

          {!active.loading && active.count > 0 && tab === "jots" && (
            <ul role="list" className="divide-y divide-white/10">
              {filteredJots.map((i) => (
                <li key={i.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <Link to="/" className="text-sm font-medium hover:underline break-words">
                        {i.title}
                      </Link>
                      {(i.raw_note || i.ai_summary) && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {i.ai_summary ?? i.raw_note}
                        </p>
                      )}
                      {i.tags.length > 0 && (
                        <p className="text-[11px] text-primary/85 mt-1.5">
                          {i.tags.map((t) => `#${t}`).join(" ")}
                        </p>
                      )}
                    </div>
                    <time className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDate(i.created_at)}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!active.loading && active.count > 0 && tab === "chats" && (
            <ul role="list" className="divide-y divide-white/10">
              {filteredChats.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "text-[11px] px-2 py-0.5 rounded-full border",
                        c.role === "assistant"
                          ? "border-primary/50 text-primary"
                          : "border-white/20 text-foreground/70",
                      )}
                    >
                      {c.role === "assistant" ? "Asher" : "You"}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {c.idea_title}
                    </span>
                    <time className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
                      {formatDate(c.created_at)}
                    </time>
                  </div>
                  <p className="text-sm leading-snug whitespace-pre-wrap break-words">
                    {c.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

const SummaryTile = ({
  icon: Icon, label, value, hint,
}: {
  icon: typeof CheckSquare;
  label: string;
  value: string;
  hint: string;
}) => (
  <div className="rounded-2xl glass-card px-4 py-3">
    <div className="flex items-center gap-2 text-foreground/80">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-xs font-medium">{label}</span>
    </div>
    <p className="text-xl font-semibold mt-1.5">{value}</p>
    <p className="text-[11px] text-muted-foreground">{hint}</p>
  </div>
);

export const Dashboard = () => (
  <ProtectedRoute>
    <DashboardInner />
  </ProtectedRoute>
);

export default Dashboard;
