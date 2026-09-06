import { cn } from "@/lib/utils";

/**
 * The one mark.
 *
 * The app used to open on a neon brain logo captioned "CAPTURE. CONNECT.
 * CREATE." in cyan and magenta, while the landing page introduced itself with
 * an amber dot and the words "Fart Brains" set in Inter. Both were fine. Two
 * were not — someone pressing "Start free" met a different company on the
 * next screen.
 *
 * This is the landing's mark, extracted so there is only one of it. The dot
 * pulses because it did there; it is the whole logo, and a product about
 * catching things before they are gone can afford a mark that looks alive.
 */
export const Wordmark = ({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center font-semibold tracking-[-0.025em] whitespace-nowrap text-foreground",
      size === "sm" && "gap-2 text-[15px]",
      size === "md" && "gap-2.5 text-[19px]",
      size === "lg" && "gap-3 text-[26px]",
      className,
    )}
  >
    <span
      aria-hidden
      className={cn(
        "rounded-full bg-primary shrink-0 animate-brand-pulse",
        size === "sm" && "h-2 w-2",
        size === "md" && "h-2.5 w-2.5",
        size === "lg" && "h-3 w-3",
      )}
      style={{ boxShadow: "0 0 12px hsl(var(--primary) / 0.8)" }}
    />
    Fart Brains
  </span>
);
