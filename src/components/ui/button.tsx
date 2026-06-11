import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--g-focus-ring,theme(colors.ring))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Default = Gemini gradient. Used app-wide so every primary action matches the orb + chat ring.
        default:
          "text-white border-0 bg-[linear-gradient(135deg,#4285F4_0%,#9B72CB_55%,#D96570_100%)] shadow-[0_6px_20px_-6px_rgba(155,114,203,0.55)] hover:shadow-[0_10px_28px_-6px_rgba(155,114,203,0.75)] hover:brightness-110 active:brightness-95",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_6px_16px_-6px_hsl(var(--destructive)/0.5)]",
        outline:
          "border border-[color:var(--g-border,hsl(var(--border)))] bg-transparent text-foreground hover:bg-white/[0.06] hover:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-white/[0.06] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline rounded-none",
        // Subtle glass — used in auth/dialogs over imagery.
        glass:
          "bg-white/10 backdrop-blur-xl border border-white/15 text-white hover:bg-white/15 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]",
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
