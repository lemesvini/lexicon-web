import * as React from "react";
import { CircleAlertIcon, HistoryIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  GroupCard,
  GroupCardBody,
  GroupCardFooter,
} from "@/features/groups/components/group-card";
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
 * The group's attendance: the last class on the panel, every class in a drawer.
 *
 * The panel used to hold the whole list, and it sat in the page's grid beside the
 * register — so every class recorded made it taller, and the register beside it
 * (the panels share a row height) grew with it. Now the panel is a fixed size:
 * the most recent class, the running total, and a button to the history.
 *
 * The history is a drawer off the right, like the group's other side panels.
 * Each day in it is still a button that moves the register onto that date, so
 * a thin-looking class is one click from the names behind it; picking one closes
 * the drawer so the register is what you see next.
 *
 * Above the last class, the meeting days nobody took a register for — a
 * forgotten register is the one mistake the plan can't see on its own, since an
 * unrecorded class looks exactly like one that hasn't happened yet. Each is a
 * button onto that day, where it can be taken or marked as no class.
 */
export function GroupAttendancePanel({
  group,
  classDate,
  onPickDate,
  pending,
  /** Bumped by the page after any write, so the history follows the register. */
  reloadKey,
}: {
  group: GroupRow;
  /** The date the register is on, highlighted here so the two panels agree. */
  classDate: string;
  onPickDate: (classDate: string) => void;
  /** Past meeting days with no register and no "no class", oldest first. */
  pending: string[];
  reloadKey: number;
}) {
  const [days, setDays] = React.useState<AttendanceDay[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [retryKey, setRetryKey] = React.useState(0);
  const [historyOpen, setHistoryOpen] = React.useState(false);

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

  // Counted across every class rather than read off the group row: the drawer
  // is the place that shows the working, so the total should come from the same
  // rows as the list in it.
  const totals = days.reduce(
    (running, day) => ({
      present: running.present + day.present,
      total: running.total + day.total,
    }),
    { present: 0, total: 0 },
  );

  // `totals.total` can be zero even with days on the list — a day every student
  // was left unmarked has rows but nothing counted — so the guard is on the
  // divisor, not on `days.length`.
  const summary =
    days.length === 0
      ? "No classes recorded yet"
      : `${days.length} class${days.length === 1 ? "" : "es"}${
          totals.total > 0
            ? ` · ${Math.round((totals.present / totals.total) * 100)}% overall`
            : ""
        }`;

  // The query comes back newest first.
  const last = days[0];

  const pick = (date: string) => {
    onPickDate(date);
    setHistoryOpen(false);
  };

  const pendingNotice = pending.length > 0 && (
    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        <CircleAlertIcon className="size-3.5 shrink-0" />
        {pending.length === 1
          ? "1 class not recorded"
          : `${pending.length} classes not recorded`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {pending.map((date) => (
          <Button
            key={date}
            variant="outline"
            size="sm"
            className="h-7 bg-background/60 px-2 text-xs"
            onClick={() => onPickDate(date)}
          >
            {dayFormat.format(fromDateKey(date))}
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <GroupCard title="Attendance">
      {status === "loading" ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full" />
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
      ) : !last ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Nothing recorded yet. Take the register and the classes will show up
          here.
        </p>
      ) : (
        <>
          <GroupCardBody className="space-y-2">
            {pendingNotice}
            <p className="text-xs text-muted-foreground">Last class</p>
            <button
              type="button"
              onClick={() => onPickDate(last.classDate)}
              aria-current={last.classDate === classDate ? "true" : undefined}
              className={cn(
                "w-full space-y-1 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent",
                last.classDate === classDate && "bg-accent",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  {dayFormat.format(fromDateKey(last.classDate))}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {last.present}/{last.total} present
                </span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {last.lessonTitle || "No lesson set"}
              </span>
            </button>
          </GroupCardBody>

          <GroupCardFooter>
            <p className="text-xs text-muted-foreground">{summary}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHistoryOpen(true)}
            >
              <HistoryIcon />
              History
            </Button>
          </GroupCardFooter>
        </>
      )}

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="max-w-lg">
          <SheetHeader>
            <SheetTitle>Attendance · {group.name}</SheetTitle>
            <SheetDescription>
              {summary}. Pick a class to open its register.
            </SheetDescription>
          </SheetHeader>

          <ul className="no-scrollbar -mx-6 min-h-0 flex-1 divide-y overflow-y-auto border-t">
            {days.map((day) => {
              const isCurrent = day.classDate === classDate;
              return (
                <li key={day.classDate}>
                  <button
                    type="button"
                    onClick={() => pick(day.classDate)}
                    aria-current={isCurrent ? "true" : undefined}
                    className={cn(
                      "w-full space-y-0.5 px-6 py-2.5 text-left transition-colors hover:bg-accent",
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
        </SheetContent>
      </Sheet>
    </GroupCard>
  );
}
