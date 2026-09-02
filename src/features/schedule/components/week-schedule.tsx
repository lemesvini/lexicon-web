import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FacetedFilter } from "@/components/data-table-faceted-filter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import {
  byStartTime,
  formatTime,
  listGroups,
  toDateKey,
  type GroupRow,
} from "@/features/groups/data/groups";
import {
  listScheduledOn,
  type ScheduledClass,
} from "@/features/groups/data/group-lessons";

/** Sunday first, the way a wall calendar is printed — and, conveniently, the
 *  order `Date.getDay()` already numbers the week in. */
const COLUMNS = [
  { weekday: 0, short: "Sun", long: "Sunday" },
  { weekday: 1, short: "Mon", long: "Monday" },
  { weekday: 2, short: "Tue", long: "Tuesday" },
  { weekday: 3, short: "Wed", long: "Wednesday" },
  { weekday: 4, short: "Thu", long: "Thursday" },
  { weekday: 5, short: "Fri", long: "Friday" },
  { weekday: 6, short: "Sat", long: "Saturday" },
] as const;

/** One column of the grid: the date it stands for, and what is on that day. */
type Day = {
  weekday: number;
  short: string;
  long: string;
  date: Date;
  /** The Postgres `date`, which is also what the planned lessons are keyed by. */
  dateKey: string;
  classes: Class[];
};

/** A group, and the lesson it is planned to teach on this particular date. */
type Class = {
  group: GroupRow;
  planned: ScheduledClass | null;
};

/** The Sunday on or before the given date, at local midnight. */
function startOfWeek(date: Date): Date {
  const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return sunday;
}

/** The seven dates of the week beginning at `sunday`. Built with `setDate` so
 *  the month, the year and a daylight-saving change all roll over on their own. */
function datesOfWeek(sunday: Date): Date[] {
  return COLUMNS.map((column) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + column.weekday);
    return date;
  });
}

/** "Aug 30 – Sep 5", or "Sep 1 – 7" when the week doesn't cross a month. */
function formatRange(dates: Date[]): string {
  const first = dates[0];
  const last = dates[dates.length - 1];
  const month = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short" });
  const sameMonth = first.getMonth() === last.getMonth();

  return sameMonth
    ? `${month(first)} ${first.getDate()} – ${last.getDate()}`
    : `${month(first)} ${first.getDate()} – ${month(last)} ${last.getDate()}`;
}

/** The day number, with the month on the 1st — the only place in a grid of bare
 *  numbers where "which month is this?" is a real question. */
function formatDayNumber(date: Date): string {
  return date.getDate() === 1
    ? `${date.toLocaleDateString(undefined, { month: "short" })} 1`
    : `${date.getDate()}`;
}

/**
 * The teaching week, seven columns wide.
 *
 * The dashboard answers "what am I teaching in an hour?" for today and tomorrow;
 * this is the other question — the shape of the week, all of it at once, which
 * is what anyone moving a class or fitting in a new group actually needs to see.
 *
 * Whose week it is follows the roster and the groups list: the database already
 * hands a teacher nothing but their own groups (0007), and the admin — who sees
 * every one of them — gets the timetable opened on their own classes, with the
 * teacher dropdown there to widen it back out to the school.
 *
 * A class lands on a day if EITHER its group meets on that weekday (0008) or one
 * of its lessons is dated to that date (0010), the same union the dashboard uses:
 * a group that meets on Tuesdays but has nothing planned still occupies its slot,
 * and a lesson dated to a Saturday is a class however the weekly pattern reads.
 *
 * Dated rather than a bare weekly pattern precisely because of that second half —
 * the planned lessons hang off real dates, so the week has to be a real week.
 */
export function WeekSchedule() {
  const { profile } = useAuth();
  const profileId = profile?.id;
  const isAdmin = profile?.role === "admin";

  const [weekStart, setWeekStart] = React.useState(() =>
    startOfWeek(new Date()),
  );
  const [groups, setGroups] = React.useState<GroupRow[]>([]);
  const [planned, setPlanned] = React.useState<Map<string, ScheduledClass[]>>(
    new Map(),
  );
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);
  // Teacher names, empty for "everyone". Seeded from the rows on the first load,
  // the same way the groups list seeds its own.
  const [teacherFilter, setTeacherFilter] = React.useState<string[]>([]);
  // Only the first load seeds it: the groups are re-read on every week change,
  // and paging a week must leave whatever the user has since chosen alone.
  const seeded = React.useRef(false);

  const dates = React.useMemo(() => datesOfWeek(weekStart), [weekStart]);
  const dateKeys = React.useMemo(() => dates.map(toDateKey), [dates]);

  // Today is read once, on mount: a page left open across midnight highlighting
  // yesterday is a smaller problem than a value changing under the render.
  const [todayKey] = React.useState(() => toDateKey(new Date()));

  React.useEffect(() => {
    let cancelled = false;
    // The groups are re-read per week too. They needn't be — the weekly pattern
    // doesn't change with the date — but paging weeks is also how you come back
    // to a week after editing a group, and one extra small query is cheaper than
    // a stale timetable.
    Promise.all([listGroups(), listScheduledOn(dateKeys)])
      .then(([groupRows, plannedByDate]) => {
        if (cancelled) return;
        if (!seeded.current) {
          seeded.current = true;
          // Matched on the id, not on `profile.fullName`: the row falls back to
          // the teacher's email when they have no name, and a filter naming
          // nobody would empty the week.
          const own = groupRows.find(
            (group) => group.teacherId === profileId,
          )?.teacher;
          if (own) setTeacherFilter([own]);
        }
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
  }, [dateKeys, reloadKey, profileId]);

  // The teacher facet narrows before the week is built, so the grid and the
  // count beside it are both about the teacher being looked at.
  const visibleGroups =
    teacherFilter.length === 0
      ? groups
      : groups.filter((group) => teacherFilter.includes(group.teacher));

  // Built from the rows rather than from a teacher list, as the groups list's
  // facet is: a deactivated teacher is out of the picker but their groups are
  // still on the timetable, and a facet that couldn't name them would leave
  // those classes unreachable.
  const teacherOptions = [
    ...new Set(groups.map((group) => group.teacher)),
  ].sort();

  const days: Day[] = COLUMNS.map((column, index) => {
    const dateKey = dateKeys[index];
    const plannedByGroup = new Map(
      (planned.get(dateKey) ?? []).map((row) => [row.groupId, row]),
    );

    return {
      ...column,
      date: dates[index],
      dateKey,
      classes: visibleGroups
        .filter(
          (group) =>
            group.status === "active" &&
            (group.meetsOn.includes(column.weekday) ||
              plannedByGroup.has(group.id)),
        )
        .map((group) => ({
          group,
          planned: plannedByGroup.get(group.id) ?? null,
        }))
        // By the hour, which is the point of `starts_at` being a time: 09:00
        // sorts above 19:00 without anyone parsing "7pm". Same-time classes fall
        // back to the name so the order is stable week to week.
        .sort(
          (a, b) =>
            byStartTime(a.group, b.group) ||
            a.group.name.localeCompare(b.group.name),
        ),
    };
  });

  /** Moves the grid, and puts it back into loading — the fetch is keyed off the
   *  new dates, so the flag is set here beside the change rather than inside the
   *  effect that reacts to it. */
  const goToWeek = (next: Date) => {
    setStatus("loading");
    setWeekStart(next);
  };

  const shiftWeeks = (weeks: number) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + weeks * 7);
    goToWeek(next);
  };

  const thisWeek = toDateKey(weekStart) === toDateKey(startOfWeek(new Date()));
  const total = days.reduce((count, day) => count + day.classes.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => shiftWeeks(-1)}
            aria-label="Previous week"
          >
            <ChevronLeftIcon />
          </Button>
          <h2 className="min-w-40 text-center text-sm font-medium">
            {formatRange(dates)}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => shiftWeeks(1)}
            aria-label="Next week"
          >
            <ChevronRightIcon />
          </Button>
          {!thisWeek && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToWeek(startOfWeek(new Date()))}
            >
              This week
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Admin-only, like the roster's and the groups list's: a teacher's
              week is all their own, so the dropdown would offer one name and
              change nothing. */}
          {isAdmin && (
            <FacetedFilter
              label="Teacher"
              options={teacherOptions}
              clearLabel="All teachers"
              value={teacherFilter}
              onValueChange={setTeacherFilter}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {status === "ready"
              ? `${total} class${total === 1 ? "" : "es"} this week`
              : " "}
          </p>
        </div>
      </div>

      {status === "error" ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
          <p className="text-sm text-muted-foreground">
            Couldn’t load the week.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatus("loading");
              setReloadKey((key) => key + 1);
            }}
          >
            <RefreshCwIcon />
            Try again
          </Button>
        </div>
      ) : (
        /* Seven columns on a wide screen, one stacked day per row below it: a
           140px-wide column can't hold a group name, and a phone reading the week
           one day at a time is the same information in the shape that fits. */
        <div className="overflow-hidden rounded-md border">
          <div className="hidden grid-cols-7 border-b bg-muted/30 md:grid">
            {days.map((day) => (
              <div
                key={day.weekday}
                className="px-3 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {day.short}
              </div>
            ))}
          </div>

          <div className="md:grid md:grid-cols-7">
            {days.map((day, index) => (
              <DayColumn
                key={day.dateKey}
                day={day}
                today={day.dateKey === todayKey}
                loading={status === "loading"}
                last={index === days.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** One day of the week: its date, and the classes on it. */
function DayColumn({
  day,
  today,
  loading,
  last,
}: {
  day: Day;
  today: boolean;
  loading: boolean;
  last: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-2 border-b p-2 md:min-h-64 md:border-r md:border-b-0",
        last && "border-b-0 md:border-r-0",
        today && "bg-accent/40",
      )}
    >
      <div className="flex items-center justify-between gap-2 md:justify-end">
        {/* The weekday name only where the header row isn't: on a phone the
            column headings are gone, and "Tue" beside the number is what makes
            the stack readable. */}
        <span className="text-xs font-medium text-muted-foreground md:hidden">
          {day.long}
        </span>
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
            today
              ? "bg-primary font-medium text-primary-foreground"
              : "text-muted-foreground",
            // The 1st carries its month, so it needs room the bare numbers don't.
            day.date.getDate() === 1 && "w-auto px-2",
          )}
        >
          {formatDayNumber(day.date)}
        </span>
      </div>

      {loading ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        day.classes.map(({ group, planned }) => (
          <ClassCard key={group.id} group={group} planned={planned} />
        ))
      )}
    </div>
  );
}

/** One class in the grid: when, who, and what they're on. Opens the group. */
function ClassCard({
  group,
  planned,
}: {
  group: GroupRow;
  planned: ScheduledClass | null;
}) {
  return (
    <Link
      to="/groups/$groupId"
      params={{ groupId: group.id }}
      className="block space-y-0.5 rounded-md border bg-card p-2 transition-colors hover:bg-accent"
    >
      <p className="truncate text-xs tabular-nums text-muted-foreground">
        {formatTime(group.startsAt) || "No time set"}
      </p>
      <p className="truncate text-sm font-medium">{group.name}</p>
      <p className="truncate text-xs text-muted-foreground">
        {planned ? planned.title || planned.lessonId : "Nothing planned"}
      </p>
    </Link>
  );
}
