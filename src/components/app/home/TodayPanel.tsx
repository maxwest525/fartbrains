import { useState, KeyboardEvent } from "react";
import { Plus, Check, Trash2, Bell, Lightbulb, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTodos,
  useCreateTodo,
  useToggleTodo,
  useDeleteTodo,
  type Todo,
} from "@/hooks/useTodos";
import { useTodayFeed } from "@/hooks/useTodayFeed";

/**
 * Bottom-left glass dashboard panel for the Ash home screen.
 * Three stacked sections: open todos, today's reminders, recent ideas.
 * Inline "+ add" creates a todo without leaving the home screen.
 */
export const TodayPanel = ({
  onOpenIdea,
}: {
  onOpenIdea?: (id: string) => void;
}) => {
  const { data: todos = [] } = useTodos();
  const { data: feed } = useTodayFeed();
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done).slice(0, 3);

  return (
    <div
      className={cn(
        "gemini-ring rounded-2xl w-full max-w-sm",
        "pointer-events-auto",
      )}
    >
      <div className="rounded-2xl bg-black/40 backdrop-blur-2xl backdrop-saturate-150 border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo
              className="h-4 w-4"
              style={{ color: "var(--g-purple)" }}
            />
            <h2 className="text-[13px] font-semibold tracking-tight text-white">
              Today
            </h2>
          </div>
          <span className="text-[11px] text-white/40">
            {open.length} open
          </span>
        </div>

        <div className="px-2 pb-2 max-h-[55vh] overflow-y-auto scroll-momentum">
          {/* Todos */}
          <Section title="To do">
            <NewTodoRow />
            {open.length === 0 && done.length === 0 ? (
              <EmptyRow text="Nothing to do." />
            ) : (
              <>
                {open.map((t) => (
                  <TodoRow key={t.id} todo={t} />
                ))}
                {done.map((t) => (
                  <TodoRow key={t.id} todo={t} />
                ))}
              </>
            )}
          </Section>

          {/* Reminders */}
          <Section title="Reminders">
            {feed?.reminders?.length ? (
              feed.reminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]"
                >
                  <Bell className="h-3.5 w-3.5 text-amber-300/80 shrink-0" />
                  <span className="text-[13px] text-white/85 truncate flex-1">
                    {r.title}
                  </span>
                  <span className="text-[11px] text-white/45 shrink-0 tabular-nums">
                    {new Date(r.remind_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            ) : (
              <EmptyRow text="No reminders firing today." />
            )}
          </Section>

          {/* Recent ideas */}
          <Section title="Recent ideas">
            {feed?.recentIdeas?.length ? (
              feed.recentIdeas.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => onOpenIdea?.(i.id)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-yellow-300/80 shrink-0" />
                  <span className="text-[13px] text-white/85 truncate">
                    {i.title}
                  </span>
                </button>
              ))
            ) : (
              <EmptyRow text="No ideas yet." />
            )}
          </Section>
        </div>
      </div>
    </div>
  );
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="px-1 pt-2 pb-1">
    <div className="px-2 pb-1 text-[10.5px] font-medium tracking-[0.08em] uppercase text-white/40">
      {title}
    </div>
    <div className="space-y-0.5">{children}</div>
  </div>
);

const EmptyRow = ({ text }: { text: string }) => (
  <div className="px-2 py-1.5 text-[12px] text-white/35">{text}</div>
);

const NewTodoRow = () => {
  const [value, setValue] = useState("");
  const create = useCreateTodo();

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    create.mutate(v, { onSuccess: () => setValue("") });
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] group">
      <button
        type="button"
        onClick={submit}
        className="h-4 w-4 rounded-full border border-white/30 flex items-center justify-center text-white/40 group-hover:text-white/70 transition shrink-0"
        aria-label="Add todo"
      >
        <Plus className="h-3 w-3" />
      </button>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder="Add a todo…"
        className="flex-1 bg-transparent outline-none text-[13px] text-white/90 placeholder:text-white/30"
      />
    </div>
  );
};

const TodoRow = ({ todo }: { todo: Todo }) => {
  const toggle = useToggleTodo();
  const del = useDeleteTodo();
  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]">
      <button
        type="button"
        onClick={() => toggle.mutate({ id: todo.id, done: !todo.done })}
        className={cn(
          "h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition",
          todo.done
            ? "bg-white/80 border-white/80 text-black"
            : "border-white/30 text-transparent hover:border-white/60",
        )}
        aria-label={todo.done ? "Mark not done" : "Mark done"}
      >
        <Check className="h-3 w-3" />
      </button>
      <span
        className={cn(
          "flex-1 text-[13px] truncate",
          todo.done ? "text-white/35 line-through" : "text-white/85",
        )}
      >
        {todo.title}
      </span>
      <button
        type="button"
        onClick={() => del.mutate(todo.id)}
        className="opacity-0 group-hover:opacity-100 transition text-white/40 hover:text-red-300"
        aria-label="Delete todo"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
