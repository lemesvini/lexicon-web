import * as React from "react";
import { RefreshCwIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
 * A panel rather than a page: the question it answers ("how has this group been
 * turning up?") is one you ask *while* looking at the register, and an answer you
 * have to navigate away to read is one you stop asking for.
 *
 * Each day is a button that moves the register onto that date, so a thin-looking
 * class is one click from the names behind it.
 */
export function GroupAttendancePanel({
  group,
  classDate,
  onPickDate,
  onClose,
  /** Bumped by the board after any write, so the history follows the register. */
  reloadKey,
}: {
  group: GroupRow;
  /** The date the register is on, highlighted here so the two panels agree. */
  classDate: string;
  onPickDate: (classDate: string) => void;
  onClose: () => void;
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
    <section className="rounded-md border">
      <header className="flex items-start justify-between gap-2 border-b py-3 pr-2 pl-4">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-medium">Attendance</h2>
          <p className="text-xs text-muted-foreground">
            {status === "ready"
              ? days.length === 0
                ? "No classes recorded yet"
                : `${days.length} class${days.length === 1 ? "" : "es"} · ${Math.round(
                    (totals.present / totals.total) * 100,
                  )}% overall`
              : group.name}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <XIcon />
          <span className="sr-only">Close the attendance panel</span>
        </Button>
      </header>

      {status === "loading" ? (
        <div className="space-y-3 p-4">
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
        <ul className="max-h-[32rem] divide-y overflow-y-auto">
          {days.map((day) => {
            const isCurrent = day.classDate === classDate;
            return (
              <li key={day.classDate}>
                <button
                  type="button"
                  onClick={() => onPickDate(day.classDate)}
                  aria-current={isCurrent ? "true" : undefined}
                  className={cn(
                    "w-full space-y-0.5 px-4 py-2.5 text-left transition-colors hover:bg-accent",
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
    </section>
  );
}
