import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-input transition-colors",
        isDark ? "bg-primary/40" : "bg-muted-foreground/20",
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full bg-background shadow-sm transition-transform",
          isDark ? "translate-x-7" : "translate-x-1",
        )}
      >
        {isDark ? (
          <Moon className="size-3.5 text-foreground" />
        ) : (
          <Sun className="size-3.5 text-foreground" />
        )}
      </span>
    </button>
  );
}
