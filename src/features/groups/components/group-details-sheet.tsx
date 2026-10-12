import { CalendarOffIcon, CircleAlertIcon } from "lucide-react";

import { SideSheet } from "@/components/side-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WeekdayPicker } from "@/features/groups/components/weekday-picker";
import type { GroupClass } from "@/features/groups/data/group-classes";
import {
  formatDays,
  formatTime,
  fromDateKey,
  setGroupDays,
  setGroupTime,
  type GroupRow,
} from "@/features/groups/data/groups";
import { cn } from "@/lib/utils";

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/**
 * Everything about the group that isn't the class on the page: when it meets,
 * the meeting days nobody recorded, and every class so far.
 *
 * Off to the side because none of it is what the page is opened for. The page
 * is the register; this is the record behind it, one button away.
 *
 * A class in the history is a button onto that class: the page moves to it, and
 * the sheet closes so the register is what you see next. A day left unrecorded
 * is a button onto a new class on that day, or can be marked as no class at all.
 */
export function GroupDetailsSheet({
  open,
  onOpenChange,
  group,
  busy,
  run,
  classes,
  pending,
  selectedClassId,
  onOpenClass,
  onRecordDay,
  onNoClass,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupRow;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  /** Every class, newest first. */
  classes: GroupClass[];
  /** Past meeting days with no class and no "no class", oldest first. */
  pending: string[];
  selectedClassId: string | null;
  onOpenClass: (entry: GroupClass) => void;
  onRecordDay: (classDate: string) => void;
  onNoClass: (classDate: string) => void;
}) {
  const time = formatTime(group.startsAt);

  // Counted across every class, excused absences included in neither half —
  // the same rule as each student's own rate.
  const totals = classes.reduce(
    (running, entry) => {
      for (const { mark } of entry.marks) {
        if (mark === "excused") continue;
        running.total += 1;
        if (mark === "present") running.present += 1;
      }
      return running;
    },
    { present: 0, total: 0 },
  );
  const summary =
    classes.length === 0
      ? "No classes recorded yet"
      : `${classes.length} class${classes.length === 1 ? "" : "es"}${
          totals.total > 0
            ? ` · ${Math.round((totals.present / totals.total) * 100)}% overall`
            : ""
        }`;

  return (
    <SideSheet
      open={open}
      onOpenChange={onOpenChange}
      title={group.name}
      description="Schedule and attendance history"
      bodyClassName="space-y-6 p-4"
    >
      <section className="space-y-3">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Schedule
        </h3>
        <Label id="schedule-days-label" className="sr-only">
          Meets on
        </Label>
        {/* Saves on each toggle: there is nothing to get half-right about one
            day. */}
        <WeekdayPicker
          value={group.meetsOn}
          disabled={busy}
          onChange={(days) => void run(() => setGroupDays(group.id, days))}
          aria-labelledby="schedule-days-label"
        />
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="schedule-time">Usually starts at</Label>
          {/* On blur: a time input fires a change for each digit typed, and
              half a time is a write the column would reject. */}
          <Input
            id="schedule-time"
            type="time"
            className="w-32"
            disabled={busy}
            key={group.startsAt ?? ""}
            defaultValue={time}
            onBlur={(event) => {
              const next = event.target.value;
              if (next === time) return;
              void run(() => setGroupTime(group.id, next));
            }}
          />
        </div>
        {group.meetsOn.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            With no days set the group won’t appear on the schedule.
          </p>
        ) : (
          !time && (
            <p className="text-xs text-muted-foreground">
              No time set — {formatDays(group.meetsOn)} classes sort last on the
              schedule, and new classes start with no time.
            </p>
          )
        )}
      </section>

      {pending.length > 0 && (
        <section className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
            <CircleAlertIcon className="size-3.5 shrink-0" />
            {pending.length === 1
              ? "1 class not recorded"
              : `${pending.length} classes not recorded`}
          </h3>
          <ul className="space-y-1">
            {pending.map((date) => (
              <li key={date} className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 bg-background/60 px-2 text-xs"
                  disabled={busy}
                  onClick={() => onRecordDay(date)}
                >
                  {dayFormat.format(fromDateKey(date))}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  disabled={busy}
                  onClick={() => onNoClass(date)}
                >
                  <CalendarOffIcon />
                  No class
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Attendance
          </h3>
          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>

        {classes.length === 0 ? (
          <p className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
            Save a register and the classes will show up here.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {classes.map((entry) => {
              const current = entry.id === selectedClassId;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onOpenClass(entry)}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "w-full space-y-0.5 px-3 py-2.5 text-left transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent",
                      current && "bg-accent",
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">
                        {dayFormat.format(fromDateKey(entry.classDate))}
                        {entry.startsAt && (
                          <span className="font-normal text-muted-foreground">
                            {" · "}
                            {formatTime(entry.startsAt)}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-sm tabular-nums text-muted-foreground",
                          entry.present === 0 && "text-destructive",
                        )}
                      >
                        {entry.present}/{entry.total}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {entry.lessonTitle || "No lesson set"}
                      {entry.present === 0 && " · nobody came, didn’t count"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </SideSheet>
  );
}
