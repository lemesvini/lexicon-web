import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { THEME_ORDER, type Theme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

const OPTIONS: Record<Theme, { label: string; icon: typeof SunIcon }> = {
  light: { label: "Light", icon: SunIcon },
  dark: { label: "Dark", icon: MoonIcon },
  system: { label: "System", icon: MonitorIcon },
};

/** A compact segmented row for picking light / dark / system. */
export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5",
        className,
      )}
    >
      {THEME_ORDER.map((value) => {
        const { label, icon: Icon } = OPTIONS[value];
        const selected = theme === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex size-6 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {/* `text-current` opts out of CommandItem's blanket svg colouring. */}
            <Icon className="size-3.5 text-current" />
          </button>
        );
      })}
    </div>
  );
}
