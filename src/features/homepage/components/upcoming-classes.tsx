import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  PlayIcon,
  SparklesIcon,
  TabletIcon,
  UsersRoundIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listGroups,
  toDateKey,
  type GroupRow,
} from "@/features/groups/data/groups";
import {
  listScheduledOn,
  type ScheduledClass,
} from "@/features/groups/data/group-lessons";

/** One of the days the dashboard looks over, named as a teacher would name it. */
type Day = {
  label: string;
  /** The Postgres `date` for that day, in the browser's timezone. */
  dateKey: string;
  weekday: number;
};

function todayAndTomorrow(): Day[] {
  const today = new Date();
  const tomorrow = new Date(today);
  // Through `setDate` rather than adding a day's worth of milliseconds: this
  // rolls the month and the year over on its own, and lands on the right
  // calendar day either side of a daylight-saving change, which arithmetic on
  // the timestamp does not.
  tomorrow.setDate(today.getDate() + 1);

  return [
    { label: "Today", dateKey: toDateKey(today), weekday: today.getDay() },
    {
      label: "Tomorrow",
      dateKey: toDateKey(tomorrow),
      weekday: tomorrow.getDay(),
    },
  ];
}

/** A group, and what it is actually doing on one particular day. */
type Class = {
  group: GroupRow;
  /** The lesson planned for this date, when there is one. */
  planned: ScheduledClass | null;
};

/**
 * What is on today and tomorrow: the groups whose day it is, and the lesson each
 * of them is planned to teach.
 *
 * Sits above the library because it is the shorter question. The library answers
 * "which of the hundred lessons do I want?"; this answers "what am I teaching in
 * an hour?" — and on a teaching day that is the only thing anyone came here for.
 * Tomorrow earns its place next to it for the other half of the job: seeing what
 * needs preparing while there is still an evening to prepare it in.
 *
 * A class is on if EITHER its group meets on that weekday (0008) or one of its
 * lessons is dated to that day (0010). The union matters both ways round: a group
 * that meets on Tuesdays but has nothing planned still needs the row, and a lesson
 * dated to a Saturday — a make-up, a one-off — is a class however the weekly
 * pattern reads.
 *
 * Renders nothing at all when there is nothing on — an empty panel on a Sunday is
 * a worse answer than no panel.
 */
export function UpcomingClasses() {
  const [groups, setGroups] = React.useState<GroupRow[]>([]);
  const [planned, setPlanned] = React.useState<Map<string, ScheduledClass[]>>(
    new Map(),
  );
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );

  // Read once on mount rather than per render: a page left open across midnight
  // showing yesterday's classes is a smaller problem than a value that changes
  // under the effect that depends on it.
  const [days] = React.useState(todayAndTomorrow);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      listGroups(),
      listScheduledOn(days.map((day) => day.dateKey)),
    ])
      .then(([groupRows, plannedByDate]) => {
        if (cancelled) return;
        setGroups(groupRows);
        setPlanned(plannedByDate);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (status === "loading") return <Skeleton className="h-28 w-full" />;

  // A failure here is silent on purpose: this is a shortcut to the library
  // below, not the library itself, and an error panel above every lesson would
  // make a broken extra feel like a broken page.
  if (status === "error") return null;

  // Only the days with something on. A "Tomorrow" heading over an empty list
  // says less than no heading at all — and on a quiet week that would be the
  // whole panel saying nothing, twice.
  const scheduled = days
    .map((day) => {
      const forDay = planned.get(day.dateKey) ?? [];
      const plannedByGroup = new Map(forDay.map((row) => [row.groupId, row]));

      const classes: Class[] = groups
        .filter(
          (group) =>
            group.status === "active" &&
            (group.meetsOn.includes(day.weekday) ||
              plannedByGroup.has(group.id)),
        )
        .map((group) => ({
          group,
          planned: plannedByGroup.get(group.id) ?? null,
        }));

      return { ...day, classes };
    })
    .filter((day) => day.classes.length > 0);

  if (scheduled.length === 0) return null;

  return (
    <div className="space-y-6">
      {scheduled.map((day, index) => (
        <section key={day.label} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-lg font-display leading-none">{day.label}</h2>
            {/* Once, above whichever day comes first: the same link under both
                headings would be two ways to one page, a few lines apart. */}
            {index === 0 && (
              <Link
                to="/groups"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                All groups
              </Link>
            )}
          </div>

          {/* One full-width row per class rather than a grid of tiles: there are
              only ever a handful in a day, and a row can put the group, the
              lesson and the way in on one line — which a tile has to stack. */}
          <ul className="space-y-3">
            {day.classes.map(({ group, planned: lesson }) => (
              <ClassRow key={group.id} group={group} planned={lesson} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** One scheduled class: who it is, what they're on, and the way into it. */
function ClassRow({
  group,
  planned,
}: {
  group: GroupRow;
  planned: ScheduledClass | null;
}) {
  return (
    <li className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-md border p-4 transition-colors hover:bg-accent/50">
      {/* The row itself opens the group. Laid over the row rather than wrapped
          around it because the launch buttons are links too, and a link inside a
          link is invalid — so this one covers the whole card and the button
          cluster is lifted above it. */}
      <Link
        to="/groups/$groupId"
        params={{ groupId: group.id }}
        search={{ tab: "register" }}
        className="absolute inset-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="sr-only">Open {group.name}</span>
      </Link>

      <div className="min-w-0 space-y-1">
        <p className="truncate font-medium">{group.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UsersRoundIcon className="size-3.5 shrink-0" />
          {group.memberCount} student{group.memberCount === 1 ? "" : "s"}
          {group.schedule && ` · ${group.schedule}`}
        </p>
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 text-right">
          {planned ? (
            /* The sparkle sits on the title's own line rather than under it:
               it qualifies the lesson ("this class's copy has extra"), and a
               second line spent saying so pushed the row taller than the group
               beside it. The count went with the line — the mark is the signal;
               how many blocks it is belongs in the lesson, not the list. */
            <p className="flex items-center justify-end gap-1.5 text-sm">
              {planned.advancedCount > 0 && (
                <SparklesIcon
                  className="size-3.5 shrink-0 text-primary"
                  aria-label="Has advanced context"
                />
              )}
              <span className="truncate">
                {planned.title || planned.lessonId}
              </span>
            </p>
          ) : (
            <p className="truncate text-sm text-muted-foreground">
              Nothing planned for this day
            </p>
          )}
        </div>

        {/* The launch pair only means anything once there is a lesson to put on
            the screen; without one the row points at the group's Lessons tab,
            which is where a date gets set. Both links carry `groupId`, so what
            opens is THIS class's copy — advanced context included — rather than
            the lesson every other group gets. */}
        {planned ? (
          <div className="relative z-10 flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link
                to="/control/$lessonId"
                params={{ lessonId: planned.lessonId }}
                search={{ groupId: group.id }}
              >
                <TabletIcon />
                <span className="sr-only">
                  Control {planned.title} for {group.name}
                </span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link
                to="/present/$lessonId"
                params={{ lessonId: planned.lessonId }}
                search={{ groupId: group.id }}
              >
                <PlayIcon />
                <span className="sr-only">
                  Present {planned.title} for {group.name}
                </span>
              </Link>
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" asChild className="relative z-10 shrink-0">
            <Link
              to="/groups/$groupId"
              params={{ groupId: group.id }}
              search={{ tab: "lessons" }}
            >
              Plan a lesson
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}
