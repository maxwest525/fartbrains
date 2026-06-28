import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Single source of truth for glassmorphic surfaces.
 * All cards, modals, popovers, and floating panels should use this so
 * opacity, blur, border, and shadow stay perfectly consistent.
 *
 * Variants:
 *  - default:  standard card surface (dark frosted)
 *  - strong:   elevated surfaces (modals, hero cards)
 *  - quiet:    nested inset panel inside another glass surface
 *  - white:    bright frosted "white glass" for highlight cards
 *
 * Use `interactive` to add hover lift + keyboard focus ring.
 */
export type GlassVariant = "default" | "strong" | "quiet" | "white";

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  interactive?: boolean;
  as?: "div" | "section" | "article" | "aside";
}

const VARIANT_CLASS: Record<GlassVariant, string> = {
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
