import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A horizontal row that scrolls forever in both directions.
 *
 * The children are rendered three times and the scroller sits on the middle
 * copy. Whenever a scroll drifts into the first or last copy we jump back by
 * exactly one copy's width — same pixels under the finger, so the seam is
 * invisible and the row never hits an end.
 *
 * Why not two copies: with two, the jump lands on an edge, and a fast flick
 * that overshoots in the same frame has nowhere to land. Three gives a whole
 * copy of runway on each side.
 *
 * Nothing animates on its own. These are buttons — a row that drifts while you
 * are trying to press something is a worse problem than a row that ends.
 */
export const LoopRow = ({
  children,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  /** Named for screen readers; the duplicate copies are hidden from them. */
  ariaLabel: string;
}) => {
  const scroller = useRef<HTMLDivElement>(null);
  const middle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    const mid = middle.current;
    if (!el || !mid) return;

    // One copy's width, remeasured on resize — folder names change length.
    let span = mid.offsetWidth;

    const centre = () => {
      span = mid.offsetWidth;
      // Only loop when there is actually more content than fits; otherwise the
      // row is short and should just sit still at the start.
      if (span > 0 && el.scrollWidth > el.clientWidth + 4) el.scrollLeft = span;
    };

    // Wait a frame so fonts and flex widths have settled before measuring.
    const raf = requestAnimationFrame(centre);

    const onScroll = () => {
      if (span <= 0) return;
      if (el.scrollLeft < span * 0.5) el.scrollLeft += span;
      else if (el.scrollLeft > span * 1.5) el.scrollLeft -= span;
    };

    const ro = new ResizeObserver(centre);
    ro.observe(mid);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [children]);

  return (
    <div
      ref={scroller}
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center overflow-x-auto no-scrollbar scroll-momentum overscroll-x-contain",
        className,
      )}
    >
      <div aria-hidden className="flex items-center shrink-0">{children}</div>
      <div ref={middle} className="flex items-center shrink-0">{children}</div>
      <div aria-hidden className="flex items-center shrink-0">{children}</div>
    </div>
  );
};
