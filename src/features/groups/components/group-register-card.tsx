import * as React from "react";
import { CheckIcon, RefreshCwIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { AddMemberDialog } from "@/features/groups/components/add-member-dialog";
import {
  GroupCard,
  GroupCardFooter,
} from "@/features/groups/components/group-card";
import {
  postponeFrom,
  type ScheduledClass,
} from "@/features/groups/data/group-lessons";
import {
  clearAttendance,
  listGroupMembers,
  removeGroupStudent,
  setAttendance,
  today,
  type GroupMember,
  type GroupRow,
} from "@/features/groups/data/groups";
import type { StudentRow } from "@/features/students/data/students";
import { cn } from "@/lib/utils";

/** Stands in for the members of a register that hasn't loaded. A shared constant
 *  rather than a fresh `[]` each render, so the memos downstream of it hold. */
const NO_MEMBERS: GroupMember[] = [];

/** An attendance share as a column reads it. Null before anything is recorded —
 *  0% would be a lie about a class that hasn't happened. */
function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/**
 * Who was there: one row per student, ticked off for one day.
 *
 * The date is a field rather than an assumption about today, because the register
 * is as often filled in the morning after as during the class. Changing it
 * reloads what was recorded for that day — an empty register for a date nobody
 * has marked yet, not a fresh set of absences.
 *
 * Everything true of the group whichever day you are looking at — its name, its
 * schedule, the lesson, the destructive actions — is on the page around this
 * rather than in it.
 */
export function GroupRegisterCard({
  group,
  classDate,
  onClassDateChange,
  planned,
  students,
  onChanged,
}: {
  group: GroupRow;
  /** The day being marked. Owned by the page rather than here, because the
   *  attendance panel moves it too — two controls on one date only agree if
   *  neither of them owns it. */
  classDate: string;
  onClassDateChange: (classDate: string) => void;
  /** What the group is planned to teach that day, fetched by the page. The
   *  register snapshots a lesson id, and the honest answer to "what did they do
   *  that day?" is what the calendar says — not `current_lesson_id`, which is a
   *  pointer somebody has to remember to move and is stale as often as not. */
  planned: ScheduledClass | null;
  /** Every student the caller can see, for the add dialog. */
  students: StudentRow[];
  /** Called when something changes that the page around this also shows. */
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

  /** Runs a write, then refreshes both this panel and the page around it. */
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

  /** What the register writes against. The plan for the day wins; the group's
   *  current lesson is the fallback for a date nothing is planned for. */
  const recordedLessonId = planned?.lessonId ?? group.lessonId;

  /**
   * One click round the register: not marked → present → absent → not marked.
   *
   * A cycle rather than a checkbox because a checkbox has two states and a
   * register has three, and the missing one is the state every student starts a
   * class in. Ticking a box only ever said "present"; marking somebody absent
   * meant ticking and unticking it, which recorded a `false` by accident of the
   * order the clicks came in. Here each state is arrived at deliberately, and
   * the third click takes the row away again — see {@link clearAttendance}.
   */
  const cycle = (member: GroupMember) => {
    const next = member.present === null ? true : member.present ? false : null;

    return run(() =>
      next === null
        ? clearAttendance({
            groupId: group.id,
            studentId: member.studentId,
            classDate,
          })
        : setAttendance({
            groupId: group.id,
            studentId: member.studentId,
            classDate,
            present: next,
            lessonId: recordedLessonId,
          }),
    );
  };

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
          lessonId: recordedLessonId,
        });
      }
    });

  const memberIds = React.useMemo(
    () => new Set(members.map((member) => member.studentId)),
    [members],
  );

  const presentCount = members.filter((member) => member.present).length;
  const absentCount = members.filter(
    (member) => member.present === false,
  ).length;
  const markedCount = presentCount + absentCount;

  /** Everyone is marked, and nobody came: the planned lesson didn't happen and
   *  is still to teach. One person present is enough for the class to count —
   *  whoever missed it catches up, the group doesn't wait. */
  const nobodyCame =
    planned !== null &&
    members.length > 0 &&
    absentCount === members.length;

  return (
    <GroupCard
      title="Register"
      action={
        <div className="flex items-center gap-2">
          {/* The date belongs to the register rather than to a settings row: it
              is the one control that changes what the list underneath it says. */}
          <Label htmlFor="class-date" className="text-xs text-muted-foreground">
            Class date
          </Label>
          <Input
            id="class-date"
            type="date"
            className="h-8 w-auto"
            value={classDate}
            max={today()}
            onChange={(event) =>
              onClassDateChange(event.target.value || today())
            }
          />
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
        </div>
      }
    >
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
        <div className="space-y-3 p-5">
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
          {/* Tiles rather than rows: taking a register is the one thing on this
              page done at speed, standing up, in front of the class — a grid of
              targets you can hit without aiming beats a column of 16px
              checkboxes. */}
          <ul className="grid gap-2 p-5 sm:grid-cols-2">
            {members.map((member) => (
              <MemberTile
                key={member.studentId}
                member={member}
                groupName={group.name}
                busy={busy}
                onCycle={() => void cycle(member)}
                onRemove={() => setRemoving(member)}
              />
            ))}
          </ul>

          {nobodyCame && (
            <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <p className="min-w-0 flex-1 text-sm">
                Nobody came, so{" "}
                <span className="font-medium">
                  {planned.title || "the planned lesson"}
                </span>{" "}
                is still to teach. Push the plan back a class to move it — and
                every lesson after it — to the next class.
              </p>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    postponeFrom(group.id, classDate, group.meetsOn),
                  )
                }
              >
                Push back a class
              </Button>
            </div>
          )}

          <GroupCardFooter>
            <span className="text-sm text-muted-foreground">
              {presentCount} of {members.length} present
              {absentCount > 0 && ` · ${absentCount} absent`}
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
          </GroupCardFooter>
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
    </GroupCard>
  );
}

/** What each of the three states looks like, and what the click that leaves it
 *  is going to do. One table rather than three ternaries down the tile — the
 *  states differ in six things, and reading them in a column is the only way to
 *  see that each one is dressed consistently. */
const STATES = {
  present: {
    label: "Present",
    next: "Tap to mark absent",
    tile: "border-primary/50 bg-primary/30 hover:bg-primary/40",
    badge: "bg-primary text-primary-foreground",
  },
  absent: {
    label: "Absent",
    next: "Tap to clear",
    tile: "border-destructive/50 bg-destructive/25 hover:bg-destructive/35",
    badge: "bg-destructive text-white",
  },
  unmarked: {
    label: "Not marked",
    next: "Tap to mark present",
    tile: "bg-card hover:bg-accent",
    badge: "bg-muted text-muted-foreground",
  },
} as const;

/**
 * One student, as a target.
 *
 * The whole tile is the button, so there is nothing to aim at. Removing them is
 * a second control, which is why it sits *over* the tile rather than inside it —
 * a button nested in a button is invalid, and every browser resolves it its own
 * way.
 */
function MemberTile({
  member,
  groupName,
  busy,
  onCycle,
  onRemove,
}: {
  member: GroupMember;
  groupName: string;
  busy: boolean;
  onCycle: () => void;
  onRemove: () => void;
}) {
  const state =
    member.present === null
      ? STATES.unmarked
      : member.present
        ? STATES.present
        : STATES.absent;

  const name = member.name || member.email;

  return (
    <li className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={onCycle}
        // The state is in the tile's colour, which a screen reader can't read,
        // so it is in the name too — and so is what the next press will do.
        aria-label={`${name}: ${state.label}. ${state.next}.`}
        className={cn(
          "w-full rounded-lg border p-3 pr-10 text-left transition-all active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60",
          state.tile,
        )}
      >
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
              state.badge,
            )}
            aria-hidden
          >
            {member.present === null ? (
              // An initial while nothing is decided: the circle is where the
              // tick lands, and something has to hold that space open.
              <span className="text-xs font-medium">
                {name.slice(0, 1).toUpperCase()}
              </span>
            ) : member.present ? (
              <CheckIcon className="size-4" />
            ) : (
              <XIcon className="size-4" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span
              className="block truncate text-xs text-muted-foreground"
              title={
                member.sessions > 0
                  ? `${member.sessions} class${member.sessions === 1 ? "" : "es"} recorded`
                  : undefined
              }
            >
              {state.label}
              {member.attendanceRate !== null &&
                ` · ${formatRate(member.attendanceRate)}`}
            </span>
          </span>
        </span>
      </button>

      <Button
        variant="ghost"
        size="icon-sm"
        disabled={busy}
        onClick={onRemove}
        className="absolute top-2 right-2 text-muted-foreground"
      >
        <XIcon />
        <span className="sr-only">
          Remove {name} from {groupName}
        </span>
      </Button>
    </li>
  );
}
