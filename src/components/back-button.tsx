import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LinkTo } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * The way back out of a page, drawn the one way it is drawn anywhere in the app:
 * a round outline button with an arrow in it and nothing else.
 *
 * No visible label, because the label was never the thing being read — at this
 * size and in this position the arrow is recognised before any word next to it
 * is. The name is still there for anyone listening to the page, and it says
 * where the arrow goes rather than "Back", which a screen reader announces
 * without the context the sighted reader gets for free.
 *
 * Lives apart from {@link SiteNav} only because two pages — the lesson console
 * and anything else that has to carry its own header — need this button without
 * the rest of that bar.
 */
export function BackButton({
  to,
  label = "Back",
  className,
}: {
  to: LinkTo;
  /** Its accessible name, e.g. "Back to the roster". */
  label?: string;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      asChild
      className={cn("rounded-full", className)}
    >
      <Link to={to} aria-label={label}>
        <ArrowLeftIcon />
      </Link>
    </Button>
  );
}
