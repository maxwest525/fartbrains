import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group toast glass-card-strong rounded-2xl text-foreground px-4 py-3 group-[.toaster]:bg-transparent group-[.toaster]:border-transparent",
          title: "text-[14px] font-semibold tracking-tight",
          description: "text-[13px] text-foreground/70",
          actionButton:
            "group-[.toast]:bg-white/15 group-[.toast]:text-foreground group-[.toast]:backdrop-blur-md group-[.toast]:rounded-full",
          cancelButton:
            "group-[.toast]:bg-white/10 group-[.toast]:text-foreground/80 group-[.toast]:rounded-full",
          success: "border-l-2 border-l-[hsl(190_95%_55%)]",
          error: "border-l-2 border-l-destructive",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
