import { LayoutGridIcon, ListIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** How the class library is drawn: covers, or one row per class. */
export type ClassView = "gallery" | "table";

const VIEWS: { value: ClassView; label: string; icon: LucideIcon }[] = [
  { value: "gallery", label: "Gallery", icon: LayoutGridIcon },
  { value: "table", label: "List", icon: ListIcon },
];

/**
 * The segmented control that swaps the library between covers and rows.
 *
 * Styled off the toolbar's other trigger (the module filter's `bg-muted` ghost
 * button) so the three controls read as one strip rather than as a table
 * control and a page control that happen to sit together.
 */
export function ClassViewToggle({
  value,
  onValueChange,
}: {
  value: ClassView;
  onValueChange: (next: ClassView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="View"
      className="flex items-center gap-0.5 rounded-md bg-muted p-0.5"
    >
      {VIEWS.map((view) => (
        <Button
          key={view.value}
          variant="ghost"
          size="icon-sm"
          aria-pressed={value === view.value}
          title={view.label}
          onClick={() => onValueChange(view.value)}
          className={cn(
            "text-muted-foreground hover:bg-background/60",
            value === view.value &&
              "bg-background text-foreground shadow-xs hover:bg-background",
          )}
        >
          <view.icon />
          <span className="sr-only">{view.label}</span>
        </Button>
      ))}
    </div>
  );
}
