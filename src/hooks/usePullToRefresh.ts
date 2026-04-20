import { useEffect, useRef, useState } from "react";

type Options = {
  /** Called when the user pulls past the threshold and releases. Should return a promise; the spinner stays until it resolves. */
  onRefresh: () => Promise<unknown> | void;
  /** Distance (px) the user must pull before a refresh is triggered. */
  threshold?: number;
  /** Maximum visual pull distance (px) — past this, the indicator stops following the finger. */
  maxPull?: number;
  /** Disable the gesture (e.g. on desktop). */
  enabled?: boolean;
};

/**
 * Pull-to-refresh for a scrollable container.
 *
 * Attach `bind` to the SCROLLABLE element (the one with overflow-y:auto).
 * The hook only starts tracking when that element is scrolled to the very top,
 * so it never fights with normal scrolling. Vertical-only — horizontal drift
 * cancels the gesture.
 */
export function usePullToRefresh<T extends HTMLElement>({
  onRefresh,
  threshold = 70,
  maxPull = 120,
  enabled = true,
}: Options) {
  const ref = useRef<T | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Latest callback without re-binding.
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let startY = 0;
    let startX = 0;
    let tracking = false;
    let currentPull = 0;

    const onStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (e.touches.length !== 1) return;
      // Only arm the gesture when already at the top of the scroll container.
      if (el.scrollTop > 0) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      tracking = true;
      currentPull = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dy = t.clientY - startY;
      const dx = Math.abs(t.clientX - startX);
      // Cancel if the user is clearly swiping sideways or scrolling up.
      if (dy <= 0 || dx > 30) {
        tracking = false;
        currentPull = 0;
        setPull(0);
        return;
      }
      // Resistance curve — feels rubbery like iOS.
      const resisted = Math.min(maxPull, dy * 0.55);
      currentPull = resisted;
      setPull(resisted);
    };

    const onEnd = async () => {
      if (!tracking) return;
      tracking = false;
      if (currentPull >= threshold) {
        setRefreshing(true);
        setPull(threshold); // park the spinner at the threshold
        try {
          await cb.current();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, threshold, maxPull, refreshing]);

  /** Spread onto the scroll container: `<div {...bind} />`. */
  const bind = { ref: (node: T | null) => { ref.current = node; } };

  return { bind, pull, refreshing, threshold };
}
