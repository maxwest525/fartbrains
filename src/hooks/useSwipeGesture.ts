import { useEffect, useRef } from "react";

type Options = {
  /** Called when a horizontal swipe is recognized. */
  onSwipe: () => void;
  /** "right" = finger moves left→right; "left" = right→left. */
  direction: "right" | "left";
  /** Only start tracking if the touch begins within this many px from the matching screen edge. Pass 0 to allow anywhere. */
  edgeSize?: number;
  /** Minimum horizontal distance to count as a swipe. */
  threshold?: number;
  /** Max vertical drift allowed (otherwise treated as a scroll). */
  maxVertical?: number;
  /** Disable the gesture (e.g. on desktop or when a modal is open). */
  enabled?: boolean;
};

/**
 * Attach to a fullscreen container ref. Listens to native touch events so it
 * works on iOS Safari without preventing vertical scroll.
 */
export const useSwipeGesture = <T extends HTMLElement>(
  ref: React.RefObject<T>,
  {
    onSwipe,
    direction,
    edgeSize = 24,
    threshold = 60,
    maxVertical = 50,
    enabled = true,
  }: Options
) => {
  // Keep the latest callback without re-binding listeners every render.
  const cb = useRef(onSwipe);
  cb.current = onSwipe;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      const w = window.innerWidth;
      // Edge-only when edgeSize > 0
      if (edgeSize > 0) {
        if (direction === "right" && t.clientX > edgeSize) return;
        if (direction === "left" && t.clientX < w - edgeSize) return;
      }
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dy > maxVertical) return;
      if (direction === "right" && dx > threshold) cb.current();
      if (direction === "left" && -dx > threshold) cb.current();
    };

    const onCancel = () => {
      tracking = false;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [ref, direction, edgeSize, threshold, maxVertical, enabled]);
};
