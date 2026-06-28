## Goal

Make the GraphPage intro animation feel instant on first open and skip entirely when the user prefers reduced motion.

## Change

**File:** `src/components/app/GraphPage.tsx`

- Kick off the intro animation synchronously on mount (in a `useLayoutEffect`) instead of waiting for a post-paint `useEffect` tick, so there is no visible "pre-animation" frame and motion begins on the very first render.
- Shorten the first-open intro duration from ~350ms to ~220ms and ease out so it lands quickly.
- Keep the module-level "first open this session" flag: subsequent opens still skip the intro entirely.
- Honor `window.matchMedia('(prefers-reduced-motion: reduce)')`:
  - Skip the intro on every open when reduced motion is set.
  - Also subscribe to `change` so a mid-session toggle is respected.
- Preserve the existing centered-on-world camera framing at the end state (no change to final transform, only how we get there).

## Out of scope

- No changes to toolbar, search, filters, or any data flow.
- No new dependencies, no schema or edge-function changes.
