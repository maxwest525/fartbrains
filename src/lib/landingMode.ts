// Tiny store so app-level chrome (window controls, install prompt, toasts)
// can hide itself while the landing page owns the screen. The chrome is
// rendered above the router in App.tsx, so it can't read routing state; the
// landing page publishes here instead.
import { useSyncExternalStore } from "react";

let active = false;
const subscribers = new Set<() => void>();

export function setLandingActive(next: boolean) {
  if (active === next) return;
  active = next;
  subscribers.forEach((fn) => fn());
}

export function useLandingActive(): boolean {
  return useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    () => active,
    () => false,
  );
}
