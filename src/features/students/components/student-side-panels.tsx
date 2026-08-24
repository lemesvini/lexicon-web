import { CheckIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatDays,
  fromDateKey,
} from "@/features/groups/data/groups";
import type {
  StudentClass,
  StudentGroup,
  StudentModuleEntry,
  StudentSummary,
} from "@/features/students/data/student-profile";
import {
  formatDate,
  formatDay,
  formatPercent,
} from "@/features/students/components/student-formats";
import {
  StudentPanel,
  StudentPanelEmpty,
  type PanelSlotProps,
} from "@/features/students/components/student-panel";

/** How many classes the register shows before it stops. Enough to see a pattern
 *  in; past that it is history, and the rate above it is the summary. */
const RECENT_CLASSES = 12;

/**
 * The classes this student was marked in or out of, newest first.
 *
 * Every row here was written by a teacher taking a register — a class with no
 * register simply isn't listed, rather than appearing as an absence. That is
 * also why the rate beside the title is out of "classes recorded" and not out of
 * the group's schedule: the two are different numbers, and only one of them is
 * known.
 */
export function StudentAttendancePanel({
  classes,
  summary,
  ...slot
}: {
  /** Newest first, as `fetchStudentDossier` returns them. */
  classes: StudentClass[];
  summary: StudentSummary;
} & PanelSlotProps) {
  // The rail scrolls, so it shows the lot; a tile has to stop somewhere.
  const shown =
    slot.variant === "flush" ? classes : classes.slice(0, RECENT_CLASSES);

  return (
    <StudentPanel
      {...slot}
      title="Attendance"
      meta={
        summary.classesRecorded === 0
          ? "No registers yet"
          : `${summary.classesAttended}/${summary.classesRecorded} · ${formatPercent(
              summary.attendanceRate,
            )}`
      }
    >
      {classes.length === 0 ? (
        <StudentPanelEmpty>
          No register has been taken for them yet. Add them to a group and tick
          them off after a class.
        </StudentPanelEmpty>
      ) : (
        <>
          <ul className="divide-y">
            {shown.map((session) => (
              <li
                key={session.id}
                className="flex items-center gap-3 px-5 py-2.5"
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    session.present
                      ? "bg-primary/15 text-primary"
                      : "bg-destructive/15 text-destructive",
                  )}
                  aria-hidden
                >
                  {session.present ? (
                    <CheckIcon className="size-3" />
                  ) : (
                    <XIcon className="size-3" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm tabular-nums">
                    {formatDay(fromDateKey(session.classDate))}
                    <span className="sr-only">
                      {session.present ? " — present" : " — absent"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[session.groupName, session.lessonTitle]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {classes.length > shown.length && (
            <p className="border-t px-5 py-2.5 text-xs text-muted-foreground">
              Showing the last {shown.length} of {classes.length} classes.
            </p>
          )}
        </>
      )}
    </StudentPanel>
  );
}

/** The groups this student sits in. A student can be in more than one — a group
 *  class and a private slot are both groups (see 0007). */
export function StudentGroupsPanel({
  groups,
  ...slot
}: { groups: StudentGroup[] } & PanelSlotProps) {
  return (
    <StudentPanel
      {...slot}
      title="Groups"
      meta={groups.length ? `${groups.length}` : undefined}
    >
      {groups.length === 0 ? (
        <StudentPanelEmpty>
          They aren’t in a group yet, so there is nobody to take a register with.
        </StudentPanelEmpty>
      ) : (
        <ul className="divide-y">
          {groups.map((group) => (
            <li key={group.id} className="space-y-0.5 px-5 py-3">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {group.name}
                </p>
                {!group.active && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Archived
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {[formatDays(group.meetsOn), group.schedule]
                  .filter(Boolean)
                  .join(" · ") || "No fixed schedule"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </StudentPanel>
  );
}

/**
 * The modules they have been through, newest first.
 *
 * The trail behind `students.current_module_id` — moving a student on marks the
 * one they're leaving completed rather than dropping it, so this is where "how
 * far have they come?" is answered.
 */
export function StudentModulesPanel({
  modules,
  ...slot
}: { modules: StudentModuleEntry[] } & PanelSlotProps) {
  const completed = modules.filter((entry) => entry.status === "completed").length;

  return (
    <StudentPanel
      {...slot}
      title="Modules"
      meta={
        modules.length === 0
          ? undefined
          : `${completed} completed of ${modules.length}`
      }
    >
      {modules.length === 0 ? (
        <StudentPanelEmpty>
          Nothing recorded yet. Placing them in a module starts their history
          here.
        </StudentPanelEmpty>
      ) : (
        <ul className="divide-y">
          {modules.map((entry) => (
            <li key={entry.moduleId} className="space-y-0.5 px-5 py-3">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  {entry.module || "—"}
                </p>
                <Badge
                  variant={
                    entry.status === "completed" ? "outline" : "secondary"
                  }
                  className={cn(
                    entry.status === "completed" && "text-muted-foreground",
                  )}
                >
                  {entry.status === "completed" ? "Completed" : "In progress"}
                </Badge>
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {entry.status === "completed"
                  ? `${formatDate(entry.startedAt)} → ${formatDate(entry.completedAt)}`
                  : `Started ${formatDate(entry.startedAt)}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </StudentPanel>
  );
}
