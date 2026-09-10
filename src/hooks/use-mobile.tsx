import * as React from "react";

const MOBILE_BREAKPOINT = 768;

const frameWidth = () => {
  if (typeof document === "undefined") return Infinity;
  const root = document.getElementById("root");
  return root?.getBoundingClientRect().width ?? window.innerWidth;
};

/**
 * True when the app's own rendering surface is narrower than the two-column
 * desktop layout needs.
 *
 * That surface is `#root`, not the browser viewport: on desktop `#root` can
 * either fill the window or be shrunk to the ~430px phone widget (see the
 * `desktop-phone` rules in index.css and DesktopWindowControls), and a user
 * who restores that widget down to phone width should get the mobile UI
 * even on a wide monitor. This mirrors the `@container appframe` queries
 * that already drive the two-column browse layout off the frame's width
 * rather than the window's — same signal, read into JS for the places that
 * can't be plain CSS (gesture affordances, conditional mounts).
 *
 * Below 768px there is no frame at all (index.css leaves #root unstyled
 * there), so the viewport and the frame are the same box and a plain resize
 * observer on #root already tracks the window.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => frameWidth() < MOBILE_BREAKPOINT);

  React.useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    const update = () => setIsMobile(frameWidth() < MOBILE_BREAKPOINT);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return isMobile;
}
