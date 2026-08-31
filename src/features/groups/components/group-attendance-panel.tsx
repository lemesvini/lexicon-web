import * as React from "react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { GroupCard } from "@/features/groups/components/group-card";
import {
  fromDateKey,
  listGroupAttendance,
  type AttendanceDay,
  type GroupRow,
} from "@/features/groups/data/groups";

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/**
 * The group's attendance, class by class — the history behind the single day the
 * register beside it is showing.
 *
 * Each day is a button that moves the register onto that date, so a thin-looking
 * class is one click from the names behind it. A panel on the page rather than a
 * drawer off a menu, which is what it was: the register and the record it builds
 * up are the same subject, and reading one against the other was two clicks and
 * a screen that slid over the answer.
 */
export function GroupAttendancePanel({
  group,
  classDate,
  onPickDate,
  /** Bumped by the page after any write, so the history follows the register. */
  reloadKey,
}: {
  group: GroupRow;
  /** The date the register is on, highlighted here so the two panels agree. */
  classDate: string;
  onPickDate: (classDate: string) => void;
  reloadKey: number;
}) {
  const [days, setDays] = React.useState<AttendanceDay[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [retryKey, setRetryKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    listGroupAttendance(group.id)
      .then((next) => {
        if (cancelled) return;
        setDays(next);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [group.id, reloadKey, retryKey]);

  const retry = () => {
    setStatus("loading");
    setRetryKey((k) => k + 1);
  };

  // Counted across every class rather than read off the group row: this panel is
  // the place that shows the working, so the total should come from the same
  // rows as the list under it.
  const totals = days.reduce(
    (running, day) => ({
      present: running.present + day.present,
      total: running.total + day.total,
    }),
    { present: 0, total: 0 },
  );

  return (
    <GroupCard
      title="Attendance"
      action={
        <p className="text-xs text-muted-foreground">
          {status === "ready"
            ? // `totals.total` can be zero even with days on the list — a day
              // every student was left unmarked has rows but nothing counted —
              // so the guard is on the divisor, not on `days.length`.
              days.length === 0
              ? "No classes recorded yet"
              : `${days.length} class${days.length === 1 ? "" : "es"}${
                  totals.total > 0
                    ? ` · ${Math.round((totals.present / totals.total) * 100)}% overall`
                    : ""
                }`
            : " "}
        </p>
      }
    >

      {status === "loading" ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      ) : status === "error" ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn’t load the attendance.
          </p>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCwIcon />
            Try again
          </Button>
        </div>
      ) : days.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Nothing recorded yet. Take the register and the classes will show up
          here.
        </p>
      ) : (
        <ul className="no-scrollbar max-h-[32rem] divide-y overflow-y-auto">
          {days.map((day) => {
            const isCurrent = day.classDate === classDate;
            return (
              <li key={day.classDate}>
                <button
                  type="button"
                  onClick={() => onPickDate(day.classDate)}
                  aria-current={isCurrent ? "true" : undefined}
                  className={cn(
                    "w-full space-y-0.5 px-5 py-2.5 text-left transition-colors hover:bg-accent",
                    isCurrent && "bg-accent",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {dayFormat.format(fromDateKey(day.classDate))}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {day.present}/{day.total}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {day.lessonTitle || "No lesson set"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </GroupCard>
  );
}
