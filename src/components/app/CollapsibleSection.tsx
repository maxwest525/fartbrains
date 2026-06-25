import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  title: ReactNode;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * Per-section collapsible used in IdeaDetail. Persists open/closed in
 * localStorage so each idea remembers what the user collapsed last time.
 * Header click toggles; the `actions` slot stays clickable independently.
 */
export const CollapsibleSection = ({
  id,
  title,
  actions,
  defaultOpen = true,
  children,
}: Props) => {
  const key = `idea-section:${id}`;
  const [open, setOpen] = useState<boolean>(defaultOpen);

  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v === "0") setOpen(false);
      else if (v === "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, [key]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggle}
          className="group flex items-center gap-1.5 text-sm font-semibold text-foreground/90 hover:text-foreground"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
          {title}
        </button>
        {actions && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
      {open && children}
    </section>
  );
};
