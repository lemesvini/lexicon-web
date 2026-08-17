import * as React from "react";
import {
  CalendarDaysIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AddMemberDialog } from "@/features/groups/components/add-member-dialog";
import { WeekdayPicker } from "@/features/groups/components/weekday-picker";
import {
  deleteGroup,
  formatSchedule,
  listGroupMembers,
  removeGroupStudent,
  setAttendance,
  setGroupDays,
  setGroupLesson,
  setGroupStatus,
  today,
  type GroupMember,
  type GroupRow,
} from "@/features/groups/data/groups";
import type { StudentRow } from "@/features/students/data/students";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";

const NO_LESSON_VALUE = "none";

/** Stands in for the members of a register that hasn't loaded. A shared constant
 *  rather than a fresh `[]` each render, so the memos downstream of it hold. */
const NO_MEMBERS: GroupMember[] = [];

/** An attendance share as a column reads it. Null before anything is recorded —
 *  0% would be a lie about a class that hasn't happened. */
function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/**
 * One group's register: the lesson it's on, and who was there on a given day.
 *
 * The date is a field rather than an assumption about today, because the
 * register is as often filled in the morning after as during the class. Changing
 * it reloads what was recorded for that day — an empty register for a date
 * nobody has marked yet, not a fresh set of absences.
 */
export function GroupRegister({
  group,
  classDate,
  onClassDateChange,
  lessons,
  students,
  attendanceOpen,
  onToggleAttendance,
  onChanged,
}: {
  group: GroupRow;
  /**
   * The day being marked. Owned by the board rather than here, because the
   * attendance panel next door moves it too — two controls on one date only
   * agree if neither of them owns it.
   */
  classDate: string;
  onClassDateChange: (classDate: string) => void;
  lessons: CloudLessonSummary[];
  /** Every student the caller can see, for the add dialog. */
  students: StudentRow[];
  attendanceOpen: boolean;
  onToggleAttendance: () => void;
  /** Called when something changes that the group list also shows. */
  onChanged: () => void;
}) {
  // What is on screen, and which day it is the register *for*. Kept together so
  // "are we showing the right day yet?" is a comparison rather than a second
  // piece of state to keep in step — see `stale` below.
  const [loaded, setLoaded] = React.useState<{
    date: string;
    members: GroupMember[];
  } | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [removing, setRemoving] = React.useState<GroupMember | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listGroupMembers(group.id, classDate)
      .then((next) => {
        if (cancelled) return;
        setLoaded({ date: classDate, members: next });
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [group.id, classDate, reloadKey]);

  const members = loaded?.members ?? NO_MEMBERS;

  // Derived rather than a "loading" flag some handler has to remember to set:
  // the skeleton shows exactly while what's loaded isn't the day being asked
  // for. Refetching the *same* day — which is what every tick of the register
  // does — leaves this false, so the list doesn't blink out from under the box
  // you just clicked. `busy` is what stops a second click landing meanwhile.
  const stale = loaded === null || loaded.date !== classDate;

  /** Refetch in place, keeping whatever is on screen until the answer lands. */
  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

  /** Runs a write, then refreshes both this panel and the list beside it. */
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      reload();
      onChanged();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const mark = (studentId: string, present: boolean) =>
    run(() =>
      setAttendance({
        groupId: group.id,
        studentId,
        classDate,
        present,
        lessonId: group.lessonId,
      }),
    );

  const markAllPresent = () =>
    run(async () => {
      // Sequential rather than Promise.all: these are upserts on the same
      // unique key, and a register is a handful of rows, not a batch job.
      for (const member of members) {
        if (member.present === true) continue;
        await setAttendance({
          groupId: group.id,
          studentId: member.studentId,
          classDate,
          present: true,
          lessonId: group.lessonId,
        });
      }
    });

  const memberIds = React.useMemo(
    () => new Set(members.map((member) => member.studentId)),
    [members],
  );

  const presentCount = members.filter((member) => member.present).length;
  const markedCount = members.filter(
    (member) => member.present !== null,
  ).length;

  return (
    <section className="rounded-md border">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {group.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {[group.teacher, formatSchedule(group)].filter(Boolean).join(" · ") ||
              "No teacher or schedule set"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* `aria-pressed` rather than a second label: the button doesn't change
              its text when the panel is out, so the state has to be said
              somewhere a screen reader will find it. */}
          <Button
            variant={attendanceOpen ? "secondary" : "outline"}
            size="sm"
            aria-pressed={attendanceOpen}
            onClick={onToggleAttendance}
          >
            <CalendarDaysIcon />
            Attendance
          </Button>
          <AddMemberDialog
            groupId={group.id}
            groupName={group.name}
            students={students}
            memberIds={memberIds}
            onAdd={() => {
              reload();
              onChanged();
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={busy}>
                <MoreHorizontalIcon />
                <span className="sr-only">Actions for {group.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() =>
                  void run(() =>
                    setGroupStatus(
                      group.id,
                      group.status === "active" ? "inactive" : "active",
                    ),
                  )
                }
              >
                {group.status === "active" ? "Archive group" : "Reactivate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmingDelete(true)}
              >
                Delete group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* A sibling of the menu rather than a child of it — a dialog rendered
          inside a DropdownMenuItem is unmounted the moment the menu closes — and
          a real dialog rather than `confirm()`, which fired from `onSelect`
          races that close. */}
      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {group.name}?</DialogTitle>
            <DialogDescription>
              The group and its attendance record go with it. The students stay
              on the roster, and everything else about them is untouched.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                setConfirmingDelete(false);
                void run(() => deleteGroup(group.id));
              }}
            >
              Delete group
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 border-b p-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label id="register-days-label">Meets on</Label>
          {/* Saves on each toggle rather than behind a Save button: there is
              nothing to get half-right about one day, and a pending edit sitting
              next to a register you're ticking is a trap. */}
          <WeekdayPicker
            value={group.meetsOn}
            disabled={busy}
            onChange={(days) => void run(() => setGroupDays(group.id, days))}
            aria-labelledby="register-days-label"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="group-lesson">Lesson</Label>
          <Select
            value={group.lessonId ?? NO_LESSON_VALUE}
            onValueChange={(value) =>
              void run(() =>
                setGroupLesson(
                  group.id,
                  value === NO_LESSON_VALUE ? null : value,
                ),
              )
            }
          >
            <SelectTrigger id="group-lesson" className="w-full">
              <SelectValue placeholder="Pick a lesson" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_LESSON_VALUE}>No lesson set</SelectItem>
              {lessons.map((lesson) => (
                <SelectItem key={lesson.id} value={lesson.id}>
                  {lesson.module ? `${lesson.module} · ` : ""}
                  {lesson.title || lesson.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="class-date">Class date</Label>
          <Input
            id="class-date"
            type="date"
            value={classDate}
            max={today()}
            onChange={(event) =>
              onClassDateChange(event.target.value || today())
            }
          />
        </div>
      </div>

      {failed ? (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn’t load the register.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFailed(false);
              reload();
            }}
          >
            <RefreshCwIcon />
            Try again
          </Button>
        </div>
      ) : stale ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nobody in this group yet. Add a student to start taking the register.
        </p>
      ) : (
        <>
          <ul className="divide-y">
            {members.map((member) => (
              <li
                key={member.studentId}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                {/* `htmlFor` rather than wrapping the checkbox: Radix renders
                    it as a button, and nesting one inside a label is the kind
                    of thing screen readers each guess at differently. */}
                <Checkbox
                  id={`present-${member.studentId}`}
                  checked={member.present === true}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    void mark(member.studentId, checked === true)
                  }
                />
                <Label
                  htmlFor={`present-${member.studentId}`}
                  className="min-w-0 flex-1 cursor-pointer items-start gap-0"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {member.name || member.email}
                    </span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {member.present === null
                        ? "Not marked"
                        : member.present
                          ? "Present"
                          : "Absent"}
                    </span>
                  </span>
                </Label>

                <span
                  className="shrink-0 text-sm tabular-nums text-muted-foreground"
                  title={`${member.sessions} class${member.sessions === 1 ? "" : "es"} recorded`}
                >
                  {formatRate(member.attendanceRate)}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() => setRemoving(member)}
                >
                  <XIcon />
                  <span className="sr-only">
                    Remove {member.name} from {group.name}
                  </span>
                </Button>
              </li>
            ))}
          </ul>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t p-4 text-sm text-muted-foreground">
            <span>
              {presentCount} of {members.length} present
              {markedCount < members.length &&
                ` · ${members.length - markedCount} not marked`}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={busy || presentCount === members.length}
              onClick={() => void markAllPresent()}
            >
              Mark all present
            </Button>
          </footer>
        </>
      )}

      <Dialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Take {removing?.name || "this student"} off {group.name}?
            </DialogTitle>
            <DialogDescription>
              They stay on the roster, and the classes they already attended stay
              on record — the group's history shouldn't rewrite itself. You can
              add them back at any time.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRemoving(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                const member = removing;
                setRemoving(null);
                if (member) {
                  void run(() =>
                    removeGroupStudent(group.id, member.studentId),
                  );
                }
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
