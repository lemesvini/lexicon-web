import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarCheckIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupAttendancePanel } from "@/features/groups/components/group-attendance-panel";
import { GroupRegisterTab } from "@/features/groups/components/group-register-tab";
import {
  deleteGroup,
  fetchGroup,
  formatSchedule,
  setGroupStatus,
  today,
  type GroupRow,
} from "@/features/groups/data/groups";
import { listStudents, type StudentRow } from "@/features/students/data/students";
import { useAuth } from "@/hooks/use-auth";
import { canUseAdvancedStudio } from "@/lib/profile";
import { listCloudLessons, type CloudLessonSummary } from "@/lib/lessons-cloud";

/**
 * One group: who is in it, and who was there today.
 *
 * The page is the register now. What a group is *taught* — the module, the
 * dates, and its own copies of every document — moved to the group's studio,
 * which does all of it and the student-facing kinds besides; keeping a thinner
 * version of the same thing here would only be two places to plan from.
 *
 * `classDate` is still owned here because two things move it: the register
 * marks a day, and picking a class in the attendance drawer jumps the register
 * onto that day. Two controls on one date only agree if neither owns it.
 */
export function GroupPage({ groupId }: { groupId: string }) {
  const navigate = useNavigate();

  const [group, setGroup] = React.useState<GroupRow | null>(null);
  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [lessons, setLessons] = React.useState<CloudLessonSummary[]>([]);
  const [status, setStatus] = React.useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [classDate, setClassDate] = React.useState(today);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [attendanceOpen, setAttendanceOpen] = React.useState(false);

  // The group's own studio is the advanced editor by another door, so it is the
  // same per-teacher permission — hidden here, enforced by the route guard.
  const studioAllowed = canUseAdvancedStudio(useAuth().profile);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([fetchGroup(groupId), listStudents(), listCloudLessons()])
      .then(([groupRow, studentRows, lessonRows]) => {
        if (cancelled) return;
        setStudents(studentRows);
        setLessons(lessonRows);
        if (!groupRow) {
          setStatus("missing");
          return;
        }
        setGroup(groupRow);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, reloadKey]);

  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status === "missing" || status === "error" || !group) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-md border text-center">
        <p className="text-sm text-muted-foreground">
          {status === "missing"
            ? "There’s no group here — it may have been deleted, or it isn’t yours."
            : "Couldn’t load this group."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/groups">Back to groups</Link>
          </Button>
          {status === "error" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus("loading");
                reload();
              }}
            >
              <RefreshCwIcon />
              Try again
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {group.name}
            {group.status === "inactive" && (
              <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">
                Archived
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[group.teacher, formatSchedule(group), group.moduleName]
              .filter(Boolean)
              .join(" · ") || "No teacher or schedule set"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {studioAllowed && (
            <Button size="sm" className="font-display" asChild>
              <Link to="/studio/group/$groupId" params={{ groupId }}>
                Studio
              </Link>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={busy}>
                <MoreHorizontalIcon />
                <span className="sr-only">Actions for {group.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setAttendanceOpen(true)}>
                <CalendarCheckIcon />
                Attendance
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
              The group goes, and with it its attendance record and every copy
              made for it — presentations, student material and homework alike,
              including any advanced context added to them. The students stay on
              the roster, and the shared lessons are untouched.
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
                void run(async () => {
                  await deleteGroup(group.id);
                  await navigate({ to: "/groups" });
                });
              }}
            >
              Delete group
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* The register, and nothing else. Everything a group's plan used to be
          answered on the Lessons tab — the module, the dates, the copies — now
          lives in the group's studio, which has all of it and the two
          student-facing kinds besides. */}
      <GroupRegisterTab
        group={group}
        classDate={classDate}
        onClassDateChange={setClassDate}
        lessons={lessons}
        students={students}
        onChanged={reload}
      />

      {/* Attendance, as a drawer off the header menu. Left-hand side on
          purpose: it is the record behind the register you are looking at, and
          a panel that slides in over the far edge of a page you are still
          reading reads as a different screen. */}
      <Sheet open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <SheetContent side="left" className="max-w-md">
          <SheetHeader>
            <SheetTitle>Attendance</SheetTitle>
            <SheetDescription>{group.name}</SheetDescription>
          </SheetHeader>
          <GroupAttendancePanel
            bare
            group={group}
            classDate={classDate}
            // Picking a class is asking to see who was in it, so it moves the
            // register onto that day and gets out of the way.
            onPickDate={(date) => {
              setClassDate(date);
              setAttendanceOpen(false);
            }}
            // The page's own reload counter: every write in the register bumps
            // it, so the history follows without the two knowing about each
            // other.
            reloadKey={reloadKey}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
