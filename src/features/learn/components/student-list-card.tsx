import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, LockIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One lesson or one homework, as a card.
 *
 * Not the jade tiles: those are the app's fixed furniture — the four doors and
 * the book — and there are four of them on a page. These are the contents of
 * the book, however many that turns out to be, so they are drawn on `card` and
 * let the tinted things above them stay the loud ones.
 *
 * The number is the student's place in the module rather than anything from the
 * database — it counts what is on the screen, which is what they are counting.
 */
export function StudentListCard({
  to,
  params,
  index,
  title,
  subtitle,
  badge,
  disabled = false,
}: {
  to: "/learn/$lessonId" | "/homework/$homeworkId";
  params: { lessonId: string } | { homeworkId: string };
  /** Its place in the list, from 1. */
  index: number;
  title: string;
  /** The unit, or the lesson a homework belongs to. */
  subtitle?: string;
  /** Where it stands, for homework. Lessons have no state to report. */
  badge?: ReactNode;
  /**
   * Listed but not openable — a lesson whose material hasn't been published.
   * Shown anyway: the syllabus is what the student signed up for, and a course
   * that grows a lesson at a time tells them nothing about how much is left.
   */
  disabled?: boolean;
}) {
  const shape =
    "group flex w-full min-w-0 items-center gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-xs";

  const inner = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border font-display text-lg",
          disabled
            ? "border-border bg-muted text-muted-foreground"
            : "border-primary/15 bg-primary/10 text-primary",
        )}
      >
        {index}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate font-montserrat font-medium",
            disabled && "text-muted-foreground",
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="block truncate font-montserrat text-sm text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>

      {badge}

      {disabled ? (
        <LockIcon className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </>
  );

  if (disabled) {
    return (
      <div aria-disabled className={cn(shape, "opacity-60")}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      // Both routes take exactly the params handed in; the union is what the
      // two callers need and what the router is given.
      to={to}
      params={params as never}
      className={cn(
        shape,
        "transition-all hover:border-primary/30 hover:shadow-md",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      {inner}
    </Link>
  );
}
