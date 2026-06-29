---
name: liquid-glass-system
description: Project-wide liquid-glass design system for this app. Use whenever building, refactoring, or styling any surface (card, modal, popover, dropdown, tooltip, sheet, drawer, toast, sidebar, panel, toolbar) so opacity, blur, border, and intent stay consistent. Three explicit variants — clear, dark (default), white — plus helpers (strong, quiet, interactive).
---

# Liquid Glass — Single Source of Truth

All glass surfaces in this project are defined in `src/index.css` under the `@layer utilities` block and exposed through `<GlassSurface variant=... />` in `src/components/ui/GlassSurface.tsx`. **Never invent new opacity/blur recipes inline** — pick a variant.

## Variants (by INTENT, not by look)

| Variant | Class | When to use |
|---|---|---|
| **clear** | `.glass-card-clear` | Near-invisible refraction. Floating overlays on rich scenery: popovers, tooltips, dropdowns, select menus, context/menubar, command bars, navigation menus, toolbars hovering over imagery. Lets the background dominate. |
| **default (dark)** | `.glass-card` | Smoked dark frosted. Primary content surfaces: cards, list rows, panels, sidebars. Body text must stay legible on any backdrop. |
| **strong** | `.glass-card-strong` | Elevated dark for modal-weight surfaces: dialogs, alert-dialogs, sheets, drawers, toasts. Heavier blur + drop shadow. |
| **quiet** | `.glass-card-quiet` | Nested inset panel inside another glass surface (e.g. a sub-section inside a card). |
| **white** | `.glass-card-white` | Luminous frosted highlight. CTA wells, hero tiles, onboarding cards where the surface itself should glow. |

Add `.glass-card-interactive` to ANY variant for hover wash + focus ring.

## Mapping (already wired)

shadcn primitives in `src/components/ui/`:

- `clear` → tooltip, popover, hover-card, dropdown-menu, select, context-menu, menubar, command, navigation-menu
- `strong` → dialog, alert-dialog, sheet, drawer, sonner (toast)
- `default` → card

## How to apply

Prefer the React component:

```tsx
import { GlassSurface } from "@/components/ui/GlassSurface";

<GlassSurface variant="clear" interactive className="p-4">…</GlassSurface>
```

Raw class is fine in shadcn primitive files:

```tsx
className="rounded-2xl glass-card-clear text-foreground p-4"
```

## Rules

1. **Never hardcode** `rgba(255,255,255,0.0X)` + `backdrop-filter` in component files. If a new use case doesn't fit a variant, extend the recipe in `src/index.css` and document it here — don't fork inline.
2. **Text colour is inherited.** The recipes set `color: #ffffff` and remap `.text-muted-foreground` to a translucent white. Don't override with `text-black` unless on a white-on-white surface.
3. **No double-blur.** Don't nest a glass-card directly inside another glass-card without using `quiet` for the inner one — stacked backdrop-filters muddy the scene.
4. **Floating overlays = clear.** If it sits above scenery and the user expects to see through it, use `clear`.
5. **Modals = strong.** If it dims/blocks the page, use `strong` so it reads as elevated.
6. **Content surfaces = default.** If text legibility matters more than transparency, use `glass-card`.

## Where to look

- Recipe definitions: `src/index.css` (search for `Liquid Glass — three distinct variants`)
- React wrapper: `src/components/ui/GlassSurface.tsx`
- Primitive mappings: `src/components/ui/{tooltip,popover,dropdown-menu,select,dialog,sheet,drawer,sonner,card}.tsx`
