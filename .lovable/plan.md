## Goals

Polish the auth screen and the GraphPage toolbar so they feel instant, readable, and uniform across screen widths.

## 1. Auth screen — no dark flash, readable contrast

**File:** `src/components/ProtectedRoute.tsx`, `src/components/app/PasscodeKeypad.tsx` (token sweep only).

- Wrap the gate's `<main>` and the vignette layer in an `animate-fade-in` so both fade in together over the always-visible aurora — eliminates any solid-dark frame between route mounts.
- Add a short `opacity` transition on the loading and "sign-in failed" fallbacks so they crossfade instead of snapping.
- Sweep the keypad/login surface for low-contrast classes:
  - Replace any `text-white/40`, `text-gray-300`, `placeholder:text-gray-400`-style values with design tokens (`text-foreground`, `text-muted-foreground`, `placeholder:text-muted-foreground`).
  - Make sure icons inside the form inherit `currentColor` from a token, not a hard-coded faded white.
  - Verify the white-frosted glass card uses `text-foreground` (AA on both the brighter aurora and the darker vignette areas).

## 2. GraphPage toolbar — 8 equal buttons, clear labels, white glass

**File:** `src/components/app/GraphPage.tsx`.

- Convert row 2 to a responsive 8-column grid that stays equal at every width:
  - `grid grid-cols-8 gap-1.5 w-full` with each button `h-9 w-full min-w-0`.
  - Order: Back · Filters · Clusters · Connections · Visibility · Zoom in · Zoom out · Recenter.
  - When `onBack` is absent, render a disabled placeholder so the remaining 7 buttons keep their column widths (no reflow).
- Restyle the toolbar + search bar with the white frosted glass recipe used elsewhere (`glass-card` tokens: white/10–15 surface, white/20 border, backdrop blur, soft inner highlight) instead of the current `bg-black/40`. Active states keep their accent tint but on the white-glass base.
- Wrap every button in the shared shadcn `Tooltip` so hover/focus shows the label, and keep `aria-label` + `title` on each button for touch and screen readers. Labels:
  - Back · Filters · Clustering controls · Connections · Hide/Show overlays · Zoom in · Zoom out · Recenter.

## 3. GraphPage intro animation — faster, reduced-motion aware

**File:** `src/components/app/GraphPage.tsx`.

- Track "first open this session" in a module-level flag.
  - First open: run the existing spin/slope/scale intro but at ~350ms.
  - Subsequent opens within the session: skip the intro entirely (nodes appear in place).
- Respect `window.matchMedia('(prefers-reduced-motion: reduce)')` — when true, skip the intro on every open.
- Keep the centered-on-world camera behavior on load so the cluster is framed immediately.

## Technical notes

- No schema or edge-function changes.
- No new dependencies. Reuse existing shadcn `Tooltip`, `glass-card` utilities, and Tailwind keyframes (`animate-fade-in`).
- All changes are presentation-only; idea/graph data flow is untouched.

## Out of scope

- No layout changes to row 1 (search bar stays full-width above the 8-button row, just restyled to match).
- No new buttons added beyond the 8 listed.
