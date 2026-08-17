import * as React from "react";
import { Link } from "@tanstack/react-router";
import { PlayIcon, TabletIcon, UsersRoundIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listClassesOn, type GroupRow } from "@/features/groups/data/groups";

const todayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * What is on today: the groups whose weekly schedule lands on this weekday, and
 * the lesson each of them is up to.
 *
 * Sits above the library because it is the shorter question. The library answers
 * "which of the hundred lessons do I want?"; this answers "what am I teaching in
 * an hour?" — and on a teaching day that is the only thing anyone came here for.
 *
 * Nothing is scheduled in advance: a group carries the days it meets on (0008),
 * and this reads them against today. So there is no session to create, none to
 * tidy up after a cancelled class, and a group that skips a week simply has no
 * attendance for it.
 *
 * Renders nothing at all when there is nothing on — an empty panel on a Sunday
 * is a worse answer than no panel.
 */
export function TodaysClasses() {
  const [classes, setClasses] = React.useState<GroupRow[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );

  // Read once on mount rather than per render: a page left open across midnight
  // showing yesterday's classes is a smaller problem than a value that changes
  // under the effect that depends on it.
  const [weekday] = React.useState(() => new Date().getDay());

  React.useEffect(() => {
    let cancelled = false;
    listClassesOn(weekday)
      .then((next: any) => {
        if (cancelled) return;
        setClasses(next);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [weekday]);

  if (status === "loading") return <Skeleton className="h-28 w-full" />;

  // A failure here is silent on purpose: this is a shortcut to the library
  // below, not the library itself, and an error panel above every lesson would
  // make a broken extra feel like a broken page.
  if (status === "error" || classes.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className=" text-lg leading-none">
          Today · {todayFormat.format(new Date())}
        </h2>
        <Link
          to="/groups"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          All groups
        </Link>
      </div>

      {/* One full-width row per class rather than a grid of tiles: there are
          only ever a handful in a day, and a row can put the group, the lesson
          and the way in on one line — which a third-width tile has to stack. */}
      <ul className="space-y-3">
        {classes.map((group) => (
          <li
            key={group.id}
            className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-md border p-4"
          >
            <div className="min-w-0 space-y-1">
              <p className="truncate font-medium">{group.name}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UsersRoundIcon className="size-3.5 shrink-0" />
                {group.memberCount} student{group.memberCount === 1 ? "" : "s"}
                {group.schedule && ` · ${group.schedule}`}
              </p>
            </div>

            <div className="flex min-w-0 items-center gap-3">
              <span className="truncate text-sm text-muted-foreground">
                {group.lessonTitle || "No lesson set"}
              </span>

              {/* The launch pair only means anything once the group is on a
                  lesson; without one there is nothing to put on the screen, so
                  the row points at the group instead. */}
              {group.lessonId ? (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      to="/control/$lessonId"
                      params={{ lessonId: group.lessonId }}
                    >
                      <TabletIcon />
                      <span className="sr-only">
                        Control {group.lessonTitle} for {group.name}
                      </span>
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      to="/present/$lessonId"
                      params={{ lessonId: group.lessonId }}
                    >
                      <PlayIcon />
                      <span className="sr-only">
                        Present {group.lessonTitle} for {group.name}
                      </span>
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" asChild className="shrink-0">
                  <Link to="/groups">Set a lesson</Link>
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
