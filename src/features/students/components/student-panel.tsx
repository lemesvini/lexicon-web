import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The card every block of the student dashboard sits in: a titled header with
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
  className,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("rounded-xl border bg-card text-card-foreground", className)}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
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
