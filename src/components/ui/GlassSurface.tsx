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

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
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

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
  ({ variant = "default", interactive = false, className, as: As = "div", ...rest }, ref) => {
    return (
      <As
        ref={ref as never}
        className={cn(
          VARIANT_CLASS[variant],
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
