import { FolderIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One module as a tile in the module gallery: its name, how many classes are
 * in it, and the colour that marks it apart from its neighbours.
 *
 * Flat colour rather than a cover image or a real title-block render — a
 * module isn't a class, it has no eyebrow or headline of its own, and this is
 * a folder, not a slide.
 */
export function ModuleCard({
  name,
  count,
  selected,
  onClick,
}: {
  name: string;
  count: number;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "group flex aspect-square w-full flex-col justify-between overflow-hidden rounded-xl border p-4 text-left shadow-sm transition-all hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        selected
          ? "border-primary bg-primary/20 text-primary ring-2 ring-primary/40 shadow-md"
          : "border-primary/15 bg-primary/10 text-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <FolderIcon className="size-6 opacity-90" />
        {selected && (
          <span className="rounded-full border border-current/25 bg-black/5 px-1.5 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.14em] opacity-90">
            Open
          </span>
        )}
      </div>

      <div className="space-y-0.5">
        <h3 className="line-clamp-3 break-words font-display text-xl leading-tight tracking-tight sm:text-2xl">
          {name || "Unfiled"}
        </h3>
        <p className="text-sm opacity-80">
          {count} class{count === 1 ? "" : "es"}
        </p>
      </div>
    </button>
  );
}
