// Tiny pub/sub for triggering the in-app full-screen alarm overlay.
// Decoupled so any reminder source (folder, idea, future) can fire it.

export type AlarmPayload = {
  title: string;
  body?: string;
};

type Listener = (p: AlarmPayload) => void;

const listeners = new Set<Listener>();

export const alarmBus = {
  trigger(p: AlarmPayload) {
    listeners.forEach((l) => {
      try {
        l(p);
      } catch {
        /* noop */
      }
    });
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
