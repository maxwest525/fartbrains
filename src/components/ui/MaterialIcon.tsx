import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

/**
 * Material Symbols Rounded glyph — Google's Gemini 2026 icon language.
 * Font is loaded in index.html. Use any symbol name from
 * https://fonts.google.com/icons (rounded set).
 *
 *   <MaterialIcon name="auto_awesome" />
 *   <MaterialIcon name="folder" filled />
 */
type Props = HTMLAttributes<HTMLSpanElement> & {
  name: string;
  filled?: boolean;
  /** Optical size in px — drives weight/grade balance. Default 20. */
  size?: number;
};

export const MaterialIcon = ({
  name,
  filled = false,
  size = 20,
  className,
  style,
  ...rest
}: Props) => (
  <span
    aria-hidden
    className={cn("material-symbols-rounded select-none leading-none", className)}
    style={{
      fontSize: size,
      lineHeight: 1,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      ...style,
    }}
    {...rest}
  >
    {name}
  </span>
);
