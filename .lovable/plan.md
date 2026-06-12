## Floating AshDock — persistence, collision, fixed position, collapse

All work is scoped to `src/components/app/AshDock.tsx` plus a small spacer hook in `src/pages/Index.tsx`. No business logic changes.

### 1. Persist position
Add `localStorage` keys:
- `ash-dock-side-v1` → `"left" | "center" | "right"` (default `"center"`)
- `ash-dock-collapsed-v1` → `"0" | "1"` (default `"0"`)

Load on mount, save on change. The dock width stays the current responsive `w-[min(48rem,calc(100vw-1rem))]`; only the horizontal anchor changes.

### 2. Fixed position that never reflows main content
Dock is already `fixed`. Confirm and harden:
- Always `position: fixed`, `z-30`, bottom = `calc(5.75rem + env(safe-area-inset-bottom))` on mobile / `1rem` on desktop.
- Horizontal anchor driven by stored side:
  - `left`  → `left-2 right-auto translate-x-0`
  - `right` → `right-2 left-auto translate-x-0`
  - `center` → current `left-1/2 -translate-x-1/2`
- Main content already lives in normal flow; we just guarantee the dock is fixed and add bottom padding via a CSS var (see #3) so nothing visually overlaps.

### 3. Collision / spacing with Capture controls
- Measure dock height with a `ResizeObserver` and write it to a CSS var on `<body>`: `--ash-dock-h`.
- In `Index.tsx` Capture view container, add `paddingBottom: 'calc(var(--ash-dock-h, 0px) + 1.25rem)'` so the orb + search never sit under the dock.
- On mobile, this stacks above the `MobileTabBar` (already accounted for via the `5.75rem` bottom offset).

### 4. Minimize / collapse with animated border preserved
Add a small header strip inside the dock with:
- A side-toggle button (cycles `left → center → right`) using `AlignLeft / AlignCenter / AlignRight` icons.
- A collapse/expand button (`ChevronDown` when open, `ChevronUp` when collapsed).

Collapsed state:
- Hide the textarea, mode/folder pickers, chips row.
- Keep the `gemini gemini-ring` wrapper (animated gradient border) visible.
- Keep only **mic** + **send** icons in a thin bar (per user choice).
- Tap the bar (or chevron) to expand.
- Smooth height transition via `transition-[height,opacity]` + `data-collapsed` attribute.

### 5. Plus sign answered inline
Already explained in chat: it's the "new chip" button. No code change.

### Technical notes
- No new deps.
- Keep all existing handlers (`handleSubmit`, `handleMic`, chips dialog) intact.
- A11y: collapse button gets `aria-expanded` + `aria-controls`; side toggle gets `aria-label="Dock position: <side>"`.
- The animated `gemini-ring` class stays on the outer wrapper so the glow border shows in both states.

### Files touched
- `src/components/app/AshDock.tsx` — add state, persistence, ResizeObserver, side anchor classes, collapse UI.
- `src/pages/Index.tsx` — add `paddingBottom: 'calc(var(--ash-dock-h,0px) + 1.25rem)'` on the Capture view container.
