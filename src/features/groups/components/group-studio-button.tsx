import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

/**
 * The way into a group's studio, drawn as the studio's mark: a G in Montserrat
 * and an S in the display face, framed — the two faces of the "GroupStudio"
 * lockup in the bar, cut down to a button.
 *
 * The frame is the button's own border and the letters are its label, so it
 * has no fill: it sits in a row of outline buttons at their height, and reads
 * as the one that is a mark rather than a word.
 */
export function GroupStudioButton({
  groupId,
  groupName,
  className,
}: {
  groupId: string;
  groupName: string;
  className?: string;
}) {
  return (
    <Link
      to="/studio/group/$groupId"
      params={{ groupId }}
      aria-label={`Open ${groupName}’s studio`}
      title="Studio"
      className={cn(
        "inline-flex h-8 gap-0.5 shrink-0 items-center rounded-lg border-2 border-primary bg-primary/20 px-1.5 text-lg leading-none text-primary transition-colors select-none hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <span aria-hidden className="font-montserrat font-semibold">
        G
      </span>
      <span aria-hidden className="-ml-[0.04em] translate-y-[0.03em] font-display">
        S
      </span>
    </Link>
  );
}
