import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A row of mutually exclusive options — the pill switch the list block has
 * always used for bullet / numbered / checklist, pulled out so every block and
 * every piece of slide chrome that offers "one of these" draws the same thing.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: LucideIcon; title?: string }[];
  /** Accessible name for the group. */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 gap-0.5 rounded-md bg-muted p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            title={o.title ?? o.label}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
              value === o.value && "bg-background text-foreground shadow-sm",
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
