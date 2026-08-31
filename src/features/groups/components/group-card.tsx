import * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The frame every panel on a group's page sits in: a titled bar, one control or
 * one figure on the right, and the panel underneath.
 *
 * Built on @/components/ui/card with its padding turned off, because half of
 * what goes in one here is an edge-to-edge list whose dividers have to reach the
 * border — `CardContent` would inset them by six. The card keeps the surface,
 * the radius and the shadow, which is the part that has to match the rest of
 * the app.
 *
 * `h-full` so two panels side by side are the same height whatever is in them —
 * a row of cards whose bottom edges don't line up reads as a mistake. What that
 * height is comes from the taller one; {@link GroupCardFooter} takes up the
 * slack, so the spare space lands between the body and the footer rather than
 * under a footer left floating mid-card.
 */
export function GroupCard({
  title,
  /** One control or one line of context, right-aligned in the bar. */
  action,
  className,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("h-full gap-0 overflow-hidden py-0", className)}>
      <header className="flex min-h-13 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-5 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {action}
      </header>
      {children}
    </Card>
  );
}

/** A panel's padded body, for the ones that hold prose or fields rather than a
 *  list. Lists are rendered straight into the card so their rules run edge to
 *  edge. */
export function GroupCardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("space-y-4 p-5", className)}>{children}</div>;
}

/** The strip along the bottom of a panel: a summary on the left, the action it
 *  summarises on the right. */
export function GroupCardFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <footer
      className={cn(
        "mt-auto flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3",
        className,
      )}
    >
      {children}
    </footer>
  );
}
