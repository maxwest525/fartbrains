import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Variants — pick by INTENT, not by look:
 *  - clear:    near-invisible refraction. Floating overlays on rich
 *              scenery (popovers, tooltips, dropdowns, command bars).
 *  - default:  smoked dark frosted. Primary content surfaces (cards,
 *              list rows, panels) where body text must stay legible.
 *  - strong:   elevated dark surfaces (modals, sheets, hero cards).
 *  - quiet:    nested inset panel inside another glass surface.
 *  - white:    luminous frosted highlight (CTA wells, hero tiles).
 *
 * Use `interactive` to add hover lift + keyboard focus ring.
 */
export type GlassVariant = "clear" | "default" | "strong" | "quiet" | "white";

/**
 * `tone` controls how the CLEAR variant adapts to the backdrop it sits on:
 *  - "auto":  follows the app theme (dark scenery → white hairline,
 *             light scenery → dark hairline). Default.
 *  - "light": force the dark-hairline / dark-text recipe. Use when the
 *             surface sits over bright imagery, white panels, or a light
 *             hero in an otherwise dark app.
 *  - "dark":  force the white-hairline / white-text recipe. Use when the
 *             surface sits over dark imagery in an otherwise light app.
 *
 * `tone` is a no-op for non-clear variants — they are intentionally
 * single-tone (default/strong/quiet are dark; white is luminous).
 */
export type GlassTone = "auto" | "light" | "dark";

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  tone?: GlassTone;
  interactive?: boolean;
  as?: "div" | "section" | "article" | "aside";
}

const VARIANT_CLASS: Record<GlassVariant, string> = {
  clear: "glass-card-clear",
  default: "glass-card",
  strong: "glass-card-strong",
  quiet: "glass-card-quiet",
  white: "glass-card-white",
};

const TONE_CLASS: Record<GlassTone, string> = {
  auto: "",
  light: "on-light",
  dark: "on-dark",
};

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
  (
    {
      variant = "default",
      tone = "auto",
      interactive = false,
      className,
      as: As = "div",
      ...rest
    },
    ref,
  ) => {
    return (
      <As
        ref={ref as never}
        className={cn(
          VARIANT_CLASS[variant],
          variant === "clear" && TONE_CLASS[tone],
          interactive && "glass-card-interactive",
          "rounded-2xl",
          className,
        )}
        {...rest}
      />
    );
  },
);
GlassSurface.displayName = "GlassSurface";

/** Convenience alias — semantically the same as <GlassSurface />. */
export const GlassCard = GlassSurface;
