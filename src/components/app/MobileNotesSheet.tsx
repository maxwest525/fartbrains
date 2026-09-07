import { useState } from "react";
import { CheckSquare, NotebookPen } from "lucide-react";

import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTodos } from "@/hooks/useTodos";
import { JotBody, TodoBody } from "@/components/app/scratchpad/panels";

/**
 * The phone half of the split view. To-dos and jots were desktop-only, which
 * meant anything captured on a laptop was unreachable on the device the user
 * actually carries. The data was always account-backed — only the UI was gated.
 *
 * Two panels do not fit side by side on a phone, so they are tabbed rather than
 * stacked: a stacked layout would put the jot pad below the fold whenever the
 * to-do list is long.
 */
export const MobileNotesSheet = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [tab, setTab] = useState<"todo" | "jot">("todo");
  const { data: todos = [] } = useTodos();
  const openTodos = todos.filter((t) => !t.done).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85dvh] p-0 flex flex-col rounded-t-2xl border-white/10"
      >
        <SheetHeader className="px-3 pt-3 pb-0 space-y-0 text-left">
          <SheetTitle className="sr-only">Notes</SheetTitle>
          <div
            role="tablist"
            aria-label="Notes"
            className="flex items-center gap-1 rounded-xl bg-white/[0.06] border border-white/10 p-1"
          >
            {(
              [
                { id: "todo", label: openTodos > 0 ? `To-do · ${openTodos}` : "To-do", Icon: CheckSquare },
                { id: "jot", label: "Jot", Icon: NotebookPen },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex-1 h-10 inline-flex items-center justify-center gap-1.5 rounded-lg text-[14px] font-semibold transition",
                  tab === id ? "bg-primary/20 text-primary" : "text-foreground/65",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </SheetHeader>

        <div
          className="flex-1 min-h-0 flex flex-col"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {tab === "todo" ? <TodoBody size="touch" /> : <JotBody size="touch" />}
        </div>
      </SheetContent>
    </Sheet>
  );
};
