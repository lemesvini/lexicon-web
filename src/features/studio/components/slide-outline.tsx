import { PlusIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { EditorSlide } from "../model";

/**
 * The deck, as a jump list.
 *
 * Only the list itself scrolls, so a deck of any length keeps its heading and
 * its "Add slide" button in place; the track is hidden because the rail has no
 * frame of its own for a scrollbar to sit against. `stacked` puts it under the
 * block palette in one shared rail — see {@link ./block-palette.tsx}.
 */
export function SlideOutline({
  slides,
  activeKey,
  stacked = false,
  onAddSlide,
  onSelectSlide,
}: {
  slides: EditorSlide[];
  activeKey: string | null;
  /** Render as a section of a shared rail rather than as a rail of its own. */
  stacked?: boolean;
  onAddSlide: () => void;
  onSelectSlide: (key: string) => void;
}) {
  return (
    <aside
      className={cn(
        stacked
          ? "flex min-h-0 shrink flex-col"
          : "sticky top-20 hidden max-h-[calc(100svh-6rem)] w-56 shrink-0 flex-col lg:flex",
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Slides
      </p>

      <ol className="no-scrollbar mt-2 min-h-0 space-y-0.5 overflow-y-auto">
        {slides.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => onSelectSlide(s.key)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                s.key === activeKey && "bg-accent font-medium",
              )}
            >
              <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate">
                {s.meta.stage || (
                  <span className="text-muted-foreground/60">Untitled</span>
                )}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {s.blocks.length}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={onAddSlide}
        className="mt-2 flex w-full shrink-0 items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <PlusIcon className="size-3.5" />
        Add slide
      </button>
    </aside>
  );
}
