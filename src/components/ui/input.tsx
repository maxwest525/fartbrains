import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Global Input — white-clear-blue glassmorphism with 0.15rem blur.
 * Auto-adapts in light + dark via the `.glass-field` utility.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "glass-field flex h-10 w-full rounded-xl px-3 py-2 text-base",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
