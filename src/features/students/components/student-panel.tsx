import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The two places a block of the student dashboard can be drawn.
 *
 * `card`   a tile in the gallery: its own border, its own background.
 * `flush`  the whole body of the detail rail: no chrome of its own, because
 *          the rail is already a bordered surface, and a card inside a card
 *          draws two lines where the reader needs none. Its header sticks to
 *          the top of the rail's scroll instead.
 */
type PanelVariant = "card" | "flush";

/** What every listing panel takes so the rail can re-dress it. Spread straight
 *  through to {@link StudentPanel} — the listings themselves don't care which
 *  of the two they are in. */
export type PanelSlotProps = {
  variant?: PanelVariant;
  onClose?: () => void;
};

/**
 * The frame every block of the student dashboard sits in: a titled header with
 * one line of context on the right, and whatever the block is underneath.
 *
 * Deliberately thinner than @/components/ui/card — the panels here hold
 * edge-to-edge lists whose dividers have to reach the border, which the padded
 * `CardContent` would inset by six.
 */
export function StudentPanel({
  title,
  /** One line of context, right-aligned in the header — a count, a rate, a date. */
  meta,
  variant = "card",
  /** Draws a close button in the header. Passed only in the rail. */
  onClose,
  className,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  variant?: PanelVariant;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const flush = variant === "flush";

  return (
    <section
      className={cn(
        flush
          ? "flex min-h-full flex-col"
          : "rounded-xl border bg-card text-card-foreground",
        className,
      )}
    >
      <header
        className={cn(
          "flex items-baseline gap-x-3 gap-y-1 border-b px-5 py-4",
          // In the rail the header outlives its own list — you scroll a term's
          // worth of homework past it, and it should keep saying what you are
          // looking at.
          flush && "sticky top-0 z-10 bg-popover",
        )}
      >
        <h2 className="min-w-0 flex-1 font-semibold">{title}</h2>
        {meta && (
          <p className="shrink-0 text-sm text-muted-foreground">{meta}</p>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-my-1 -mr-2 shrink-0 self-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </header>
      {children}
    </section>
  );
}

/** What a panel says when it has nothing to list. A sentence rather than a
 *  dash: an empty panel should say why it is empty and what fills it. */
export function StudentPanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
