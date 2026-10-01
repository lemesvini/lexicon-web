import * as React from "react";
import {
  BookmarkIcon,
  CalendarOffIcon,
  CheckIcon,
  MinusIcon,
  MoreVerticalIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  GroupCard,
  GroupCardFooter,
} from "@/features/groups/components/group-card";
import {
  clearAttendance,
  listGroupMembers,
  removeGroupStudent,
  setAttendance,
  today,
  type GroupMember,
  type GroupRow,
} from "@/features/groups/data/groups";
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
  lessonId,
  lessonTitle,
  cancelled,
  onCancelledChange,
  refreshKey,
  onChanged,
}: {
  group: GroupRow;
  /** The day being marked. Owned by the page rather than here, because the
   *  attendance panel moves it too — two controls on one date only agree if
   *  neither of them owns it. */
  classDate: string;
  onClassDateChange: (classDate: string) => void;
  /** The lesson this day's register is for, worked out by the page from the
   *  register itself (see `lessonForDay`). Snapshotted onto every mark. */
  lessonId: string | null;
  lessonTitle: string;
  /** The day is marked as having no class (0025). */
  cancelled: boolean;
  onCancelledChange: (cancelled: boolean) => Promise<void>;
  /** The page's reload counter. Students are added from the page's actions
   *  menu now, so the register has to hear about it from outside. */
  refreshKey: number;
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
  }, [group.id, classDate, reloadKey, refreshKey]);

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
    return mark(member, next);
  };

  /** Sets one student's mark for the day: in, out (with or without a reason),
   *  or — null — not marked at all. */
  const mark = (
    member: GroupMember,
    next: boolean | null,
    excused = false,
  ) => {

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
            excused,
            lessonId,
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
          lessonId,
        });
      }
    });

  const presentCount = members.filter((member) => member.present).length;
  const absentCount = members.filter(
    (member) => member.present === false,
  ).length;
  const markedCount = presentCount + absentCount;

  /** Everyone is marked, and nobody came. The class didn't happen, so its
   *  lesson is still the next one — the plan works that out from the register
   *  on its own, and this only says so. */
  const nobodyCame = members.length > 0 && absentCount === members.length;

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
      ) : cancelled ? (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <CalendarOffIcon className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No class on this day. It doesn’t count towards anyone’s attendance,
            and the plan skips it.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void run(() => onCancelledChange(false))}
          >
            There was a class
          </Button>
        </div>
      ) : members.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nobody in this group yet. Add students from the ⋯ menu at the top of the page to start taking the register.
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
                onExcuse={() => void mark(member, false, true)}
                onClear={() => void mark(member, null)}
                onRemove={() => setRemoving(member)}
              />
            ))}
          </ul>

          {nobodyCame && (
            <p className="mx-5 mb-5 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
              Nobody came, so this class didn’t count.{" "}
              {lessonTitle ? (
                <>
                  <span className="font-medium text-foreground">
                    {lessonTitle}
                  </span>{" "}
                  stays the next lesson
                </>
              ) : (
                "The next lesson stays the same"
              )}{" "}
              and the plan’s dates move on by themselves.
            </p>
          )}

          <GroupCardFooter>
            <span className="text-sm text-muted-foreground">
              {presentCount} of {members.length} present
              {absentCount > 0 && ` · ${absentCount} absent`}
              {markedCount < members.length &&
                ` · ${members.length - markedCount} not marked`}
            </span>
            <div className="flex items-center gap-2">
              {/* Only on a day nobody has been marked for: once somebody is,
                  the day had a class, or at least the register says so. */}
              {markedCount === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void run(() => onCancelledChange(true))}
                >
                  <CalendarOffIcon />
                  No class this day
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={busy || presentCount === members.length}
                onClick={() => void markAllPresent()}
              >
                Mark all present
              </Button>
            </div>
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

/** What each state looks like, and what the click that leaves it is going to
 *  do. One table rather than ternaries down the tile — the states differ in
 *  several things, and reading them in a column is the only way to see that
 *  each one is dressed consistently. */
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
  excused: {
    label: "Excused absence",
    next: "Tap to clear",
    tile: "border-dashed border-muted-foreground/40 bg-muted/60 hover:bg-muted",
    badge: "bg-muted-foreground/70 text-background",
  },
  unmarked: {
    label: "Not marked",
    next: "Tap to mark present",
    tile: "bg-card hover:bg-accent",
    badge: "bg-muted text-muted-foreground",
  },
} as const;

/** "[Lesson Four] Comparing Trips" → "Lesson Four", which is what fits on a
 *  tile. */
function shortLesson(title: string): string {
  const match = /^\s*\[([^\]]+)\]/.exec(title);
  return match?.[1]?.trim() || title;
}

/**
 * One student, as a target.
 *
 * The whole tile is the button, so there is nothing to aim at: a tap goes round
 * not marked → present → absent → not marked, which is the register taken at
 * speed. The rarer marks — an absence with a reason, clearing, taking them off
 * the group — are in a menu that sits *over* the tile rather than inside it,
 * since a button nested in a button is invalid HTML.
 *
 * Under the name, what they have to catch up on: lessons the group was taught
 * while they were away, that no register has had them at since.
 */
function MemberTile({
  member,
  groupName,
  busy,
  onCycle,
  onExcuse,
  onClear,
  onRemove,
}: {
  member: GroupMember;
  groupName: string;
  busy: boolean;
  onCycle: () => void;
  onExcuse: () => void;
  onClear: () => void;
  onRemove: () => void;
}) {
  const state =
    member.present === null
      ? STATES.unmarked
      : member.present
        ? STATES.present
        : member.excused
          ? STATES.excused
          : STATES.absent;

  const name = member.name || member.email;
  const missed = member.missed;

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
            ) : member.excused ? (
              <MinusIcon className="size-4" />
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
            {missed.length > 0 && (
              <span
                className="mt-1 flex items-center gap-1 truncate text-xs text-amber-700 dark:text-amber-400"
                title={missed
                  .map((entry) => entry.title || entry.lessonId)
                  .join("\n")}
              >
                <BookmarkIcon className="size-3 shrink-0" />
                To catch up:{" "}
                {missed.map((entry) => shortLesson(entry.title)).join(", ")}
              </span>
            )}
          </span>
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={busy}
            className="absolute top-2 right-2 text-muted-foreground"
          >
            <MoreVerticalIcon />
            <span className="sr-only">More for {name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={member.present === false && member.excused}
            onSelect={onExcuse}
          >
            <MinusIcon />
            Excused absence
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={member.present === null}
            onSelect={onClear}
          >
            <XIcon />
            Clear mark
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={onRemove}>
            Remove from {groupName}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
