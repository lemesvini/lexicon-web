import { LayoutGridIcon, ListIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** How the library is drawn: one row per artifact, or a grid of covers. */
export type LibraryView = "table" | "gallery";

const VIEWS: { value: LibraryView; label: string; icon: LucideIcon }[] = [
  { value: "gallery", label: "Gallery", icon: LayoutGridIcon },
  { value: "table", label: "List", icon: ListIcon },
];

/**
 * The segmented control that swaps the library between covers and rows.
 *
 * Same control as the homepage's (@/features/homepage/components/class-view-toggle),
 * minus the module view — the Studio's gallery is already grouped by module, so
 * there is nothing for a third view to say.
 */
export function LibraryViewToggle({
  value,
  onValueChange,
}: {
  value: LibraryView;
  onValueChange: (next: LibraryView) => void;
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
