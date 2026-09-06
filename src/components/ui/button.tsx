import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--g-focus-ring,theme(colors.ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /* The primary action, in the brand's one action colour.
           This used to be a hardcoded three-stop gradient in #4285F4, #9B72CB
           and #D96570 — Google's palette, on every primary button in the
           product. It ignored the design tokens entirely, which is why
           retinting the app changed everything except the buttons, and why
           passing bg-primary alongside it did nothing: that sets a background
           colour, and the gradient is a background image painted over it.
           Flat, because a gradient across two brand colours reads as
           decoration and this is the one thing on screen asking to be pressed. */
        default:
          "bg-primary text-primary-foreground border-0 shadow-[0_6px_20px_-8px_hsl(var(--primary)/0.55)] hover:bg-primary/90 hover:shadow-[0_10px_28px_-8px_hsl(var(--primary)/0.6)] active:brightness-95",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_6px_16px_-6px_hsl(var(--destructive)/0.5)]",
        outline:
          "border border-[color:var(--g-border,hsl(var(--border)))] bg-transparent text-foreground hover:bg-white/[0.06] hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "border-0 bg-transparent text-foreground hover:bg-transparent hover:text-[color:var(--g-purple,hsl(var(--primary)))] transition-colors",
        link: "text-[color:var(--g-purple)] underline-offset-4 hover:underline rounded-none bg-transparent",
        // Subtle glass — used in auth/dialogs over imagery. Fades to zero on hover.
        glass:
          "glass-pill rounded-full text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0",
        // Gemini icon — naked icon button, no border or background, tints on hover.
        "gemini-icon":
          "gemini-icon rounded-full focus-visible:ring-2 focus-visible:ring-[color:var(--g-focus-ring)] focus-visible:ring-offset-0",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-12 px-8 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
