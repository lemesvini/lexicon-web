import * as React from "react";
import {
  BookmarkIcon,
  CheckIcon,
  MinusIcon,
  MoreVerticalIcon,
  Trash2Icon,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  GroupCard,
  GroupCardFooter,
} from "@/features/groups/components/group-card";
import type { Mark, MissedLesson } from "@/features/groups/data/group-classes";
import { cn } from "@/lib/utils";

/** One student on the register, with this class's mark and their record. */
export type RegisterRow = {
  studentId: string;
  name: string;
  email: string;
  /** This class's mark, as it stands in the form. Null: not marked. */
  mark: Mark | null;
  /** Their share across every class, 0–1, excused absences left out. Null
   *  before any is recorded. */
  rate: number | null;
  /** How many classes the rate is out of. */
  sessions: number;
  missed: MissedLesson[];
  /** False for a student marked in this class who has since left the group:
   *  their mark is history and stays editable, but there is nothing to remove
   *  them from. */
  member: boolean;
};

/** What each state looks like, and what the click that leaves it does. */
const STATES = {
  present: {
    label: "Present",
    next: "Click to mark absent",
    row: "bg-primary/10 hover:bg-primary/15",
    pill: "bg-primary text-primary-foreground",
    icon: CheckIcon,
  },
  absent: {
    label: "Absent",
    next: "Click to clear",
    row: "bg-destructive/10 hover:bg-destructive/15",
    pill: "bg-destructive text-white",
    icon: XIcon,
  },
  excused: {
    label: "Excused",
    next: "Click to clear",
    row: "bg-muted/60 hover:bg-muted",
    pill: "bg-muted-foreground/70 text-background",
    icon: MinusIcon,
  },
  unmarked: {
    label: "Not marked",
    next: "Click to mark present",
    row: "hover:bg-accent",
    pill: "border border-dashed text-muted-foreground",
    icon: null,
  },
} as const;

/** Not marked → present → absent → not marked: a register taken at speed. An
 *  excused absence is a deliberate choice from the row's menu. */
function cycle(mark: Mark | null): Mark | null {
  return mark === null ? "present" : mark === "present" ? "absent" : null;
}

function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/** "[Lesson Four] Comparing Trips" → "Lesson Four". */
function shortLesson(title: string): string {
  const match = /^\s*\[([^\]]+)\]/.exec(title);
  return match?.[1]?.trim() || title;
}

/**
 * Who was at the class: one row per student, marked for the class on the page.
 *
 * The register the tiles used to be, as a table — a click anywhere on a row
 * goes round not marked → present → absent → not marked; the rarer marks and
 * taking someone off the group are in the row's menu. Beside each name, their
 * attendance so far and what they have to catch up on.
 *
 * Nothing here writes on its own. The marks are part of the class, and go in
 * with its lesson, date and time when it is saved.
 */
export function GroupRegisterTable({
  groupName,
  rows,
  isNew,
  dirty,
  busy,
  onMark,
  onMarkAll,
  onSave,
  onDiscard,
  onDelete,
  onRemoveStudent,
}: {
  groupName: string;
  rows: RegisterRow[];
  /** The class hasn't been recorded yet. */
  isNew: boolean;
  dirty: boolean;
  busy: boolean;
  onMark: (studentId: string, mark: Mark | null) => void;
  onMarkAll: (mark: Mark) => void;
  onSave: () => void;
  onDiscard: () => void;
  /** Deletes the recorded class. Only offered when there is one. */
  onDelete: () => void;
  onRemoveStudent: (studentId: string) => void;
}) {
  const [removing, setRemoving] = React.useState<RegisterRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const present = rows.filter((row) => row.mark === "present").length;
  const absent = rows.filter(
    (row) => row.mark === "absent" || row.mark === "excused",
  ).length;
  const unmarked = rows.length - present - absent;
  const anyMarked = present + absent > 0;

  return (
    <GroupCard
      title="Register"
      action={
        rows.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {present} of {rows.length} present
            {absent > 0 && ` · ${absent} absent`}
            {unmarked > 0 && ` · ${unmarked} not marked`}
          </span>
        )
      }
    >
      {rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Nobody in this group yet. Add students from the ⋯ menu at the top of
          the page to start taking the register.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Student</TableHead>
              <TableHead className="w-36">This class</TableHead>
              <TableHead className="hidden w-28 sm:table-cell">
                Attendance
              </TableHead>
              <TableHead className="hidden md:table-cell">To catch up</TableHead>
              <TableHead className="w-12 pr-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const state = STATES[row.mark ?? "unmarked"];
              const Icon = state.icon;
              const name = row.name || row.email;
              const next = () => onMark(row.studentId, cycle(row.mark));

              return (
                <TableRow
                  key={row.studentId}
                  onClick={busy ? undefined : next}
                  className={cn(
                    "cursor-pointer transition-colors select-none",
                    state.row,
                  )}
                >
                  <TableCell className="max-w-0 pl-5">
                    <span className="block truncate font-medium">{name}</span>
                    {!row.member && (
                      <span className="block truncate text-xs text-muted-foreground">
                        No longer in {groupName}
                      </span>
                    )}
                    {/* On a narrow screen the catch-up column is gone, so it
                        comes under the name instead. */}
                    {row.missed.length > 0 && (
                      <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-amber-700 md:hidden dark:text-amber-400">
                        <BookmarkIcon className="size-3 shrink-0" />
                        {row.missed.map((entry) => shortLesson(entry.title)).join(", ")}
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    {/* The keyboard's way in; the row's click is the mouse's. */}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        next();
                      }}
                      aria-label={`${name}: ${state.label}. ${state.next}.`}
                      className={cn(
                        "inline-flex h-7 min-w-28 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60",
                        state.pill,
                      )}
                    >
                      {Icon && <Icon className="size-3.5" />}
                      {state.label}
                    </button>
                  </TableCell>

                  <TableCell
                    className="hidden text-muted-foreground tabular-nums sm:table-cell"
                    title={
                      row.sessions > 0
                        ? `${row.sessions} class${row.sessions === 1 ? "" : "es"} recorded`
                        : undefined
                    }
                  >
                    {formatRate(row.rate)}
                  </TableCell>

                  <TableCell className="hidden max-w-0 md:table-cell">
                    {row.missed.length > 0 ? (
                      <span
                        className="flex items-center gap-1 truncate text-xs text-amber-700 dark:text-amber-400"
                        title={row.missed
                          .map((entry) => entry.title || entry.lessonId)
                          .join("\n")}
                      >
                        <BookmarkIcon className="size-3 shrink-0" />
                        {row.missed.map((entry) => shortLesson(entry.title)).join(", ")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell
                    className="pr-3"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busy}
                          className="text-muted-foreground"
                        >
                          <MoreVerticalIcon />
                          <span className="sr-only">More for {name}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={row.mark === "excused"}
                          onSelect={() => onMark(row.studentId, "excused")}
                        >
                          <MinusIcon />
                          Excused absence
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={row.mark === null}
                          onSelect={() => onMark(row.studentId, null)}
                        >
                          <XIcon />
                          Clear mark
                        </DropdownMenuItem>
                        {row.member && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => setRemoving(row)}
                            >
                              Remove from {groupName}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <GroupCardFooter>
        <div className="flex items-center gap-2">
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => setDeleting(true)}
            >
              <Trash2Icon />
              Delete class
            </Button>
          )}
          {rows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy || present === rows.length}
              onClick={() => onMarkAll("present")}
            >
              Mark all present
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {dirty && (
            <Button variant="ghost" size="sm" disabled={busy} onClick={onDiscard}>
              Discard
            </Button>
          )}
          <Button
            size="sm"
            // A new class needs somebody marked: a register with nobody on it
            // records nothing. An existing one can be emptied — that is an edit.
            disabled={busy || !dirty || (isNew && !anyMarked)}
            onClick={onSave}
          >
            {isNew ? "Save class" : "Save changes"}
          </Button>
        </div>
      </GroupCardFooter>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Take {removing?.name || "this student"} off {groupName}?
            </DialogTitle>
            <DialogDescription>
              They stay on the roster, and the classes they already attended stay
              on record — the group's history shouldn't rewrite itself. You can
              add them back at any time.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) onRemoveStudent(removing.studentId);
                setRemoving(null);
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this class?</DialogTitle>
            <DialogDescription>
              The class and everyone’s mark in it go. If it was the last class
              with somebody present, the suggested lesson moves back to match.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDeleting(false);
                onDelete();
              }}
            >
              Delete class
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </GroupCard>
  );
}
