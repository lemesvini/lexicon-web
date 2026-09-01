import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MoreHorizontalIcon, RefreshCwIcon } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupAttendancePanel } from "@/features/groups/components/group-attendance-panel";
import { GroupLessonCard } from "@/features/groups/components/group-lesson-card";
import { GroupModulePrompt } from "@/features/groups/components/group-module-prompt";
import { GroupRegisterCard } from "@/features/groups/components/group-register-card";
import { GroupScheduleCard } from "@/features/groups/components/group-schedule-card";
import {
  listScheduledOn,
  type ScheduledClass,
} from "@/features/groups/data/group-lessons";
import {
  deleteGroup,
  fetchGroup,
  formatSchedule,
  listGroupStudentIds,
  setGroupStatus,
  today,
  type GroupRow,
} from "@/features/groups/data/groups";
import {
  listModules,
  listStudents,
  type ModuleOption,
  type StudentRow,
} from "@/features/students/data/students";
import { useAuth } from "@/hooks/use-auth";
import { canUseAdvancedStudio } from "@/lib/profile";
import { listCloudLessons, type CloudLessonSummary } from "@/lib/lessons-cloud";

/**
 * One group, as four panels: what they are doing today, when they meet, who was
 * there, and the record that has built up behind it.
 *
 * It was one long form — a row of settings, then a list — which put the fields
 * nobody touches from one term to the next above the thing the page is usually
 * opened for. Now the lesson leads, with Present and Control on it, and the
 * settings sit in a panel of their own beside the register.
 *
 * What a group is *taught* — the module, the dates, and its own copies of every
 * document — lives in the group's studio, which does all of it and the
 * student-facing kinds besides; keeping a thinner version of the same thing here
 * would only be two places to plan from.
 *
 * `classDate` is owned here because three panels move with it: the register marks
 * a day, the lesson panel shows what that day is for, and picking a class in the
 * attendance panel jumps the register onto that date. Controls on one date only
 * agree if none of them owns it.
 *
 * `planned` is fetched here for the same reason — the register records it and the
 * lesson panel shows it, and two components asking separately is two answers.
 */
export function GroupPage({ groupId }: { groupId: string }) {
  const navigate = useNavigate();

  const [group, setGroup] = React.useState<GroupRow | null>(null);
  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [lessons, setLessons] = React.useState<CloudLessonSummary[]>([]);
  const [modules, setModules] = React.useState<ModuleOption[]>([]);
  const [memberIds, setMemberIds] = React.useState<string[]>([]);
  const [status, setStatus] = React.useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [classDate, setClassDate] = React.useState(today);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [planned, setPlanned] = React.useState<ScheduledClass | null>(null);

  // The group's own studio is the advanced editor by another door, so it is the
  // same per-teacher permission — hidden here, enforced by the route guard.
  const studioAllowed = canUseAdvancedStudio(useAuth().profile);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchGroup(groupId),
      listStudents(),
      listCloudLessons(),
      listModules(),
      listGroupStudentIds(groupId),
    ])
      .then(([groupRow, studentRows, lessonRows, moduleRows, ids]) => {
        if (cancelled) return;
        setStudents(studentRows);
        setLessons(lessonRows);
        setModules(moduleRows);
        setMemberIds(ids);
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

  // What this group is planned to teach on the day being looked at (0010).
  // Separate from the group itself because it moves with the date rather than
  // with the group, and a failure is not fatal: without it both panels fall back
  // to `current_lesson_id`, which is what they always used to use.
  React.useEffect(() => {
    let cancelled = false;
    listScheduledOn([classDate])
      .then((byDate) => {
        if (cancelled) return;
        setPlanned(
          (byDate.get(classDate) ?? []).find((row) => row.groupId === groupId) ??
            null,
        );
      })
      .catch(() => {
        if (!cancelled) setPlanned(null);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, classDate, reloadKey]);

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

  // Unplaced on both sides. A student already in a module — one moved up on
  // their own, say — is enough to say this group has been placed, and the
  // prompt would be a second control on a fact somebody has already answered.
  const placedIds = new Set(memberIds);
  const needsModule =
    !group.moduleId &&
    !students.some((student) => placedIds.has(student.id) && student.moduleId);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            {/* Montserrat rather than the page's Inter, and a size up: the
                group's name is the one thing on the page that is a name, and it
                is the face the bar's own lockups are set in. */}
            <h1 className="truncate font-montserrat text-3xl font-bold tracking-tight">
              {group.name}
            </h1>
            {group.status === "inactive" && (
              <Badge variant="outline" className="text-muted-foreground">
                Archived
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {[group.teacher, formatSchedule(group), group.moduleName]
              .filter(Boolean)
              .join(" · ") || "No teacher or schedule set"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
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

          {/* The studio, in the display face after the menu — lower case, as
              the wordmark is, because it is a name rather than a sentence. The
              word is cut out of the chip rather than drawn on it
              (`text-background`), so what reads as the letters is the page
              showing through. */}
          {studioAllowed && (
            <Link
              to="/studio/group/$groupId"
              params={{ groupId }}
              aria-label={`Open ${group.name}’s studio`}
              className="flex h-10 items-center rounded-lg bg-primary px-3 font-display text-2xl leading-none text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              <span aria-hidden>studio</span>
            </Link>
          )}
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

      {/* Only while nothing has been placed: the group is in no module and
          neither is anyone on its roster. Once either is true the module is
          the studio's, where the lessons it copies are set. */}
      {needsModule && (
        <GroupModulePrompt
          group={group}
          modules={modules}
          studentIds={memberIds}
          busy={busy}
          run={run}
        />
      )}

      {/* Two columns on a wide screen: what happens in the class on the left,
          what is true of the group on the right. They stack in the same order on
          a phone, which is also the order they are read in — the lesson first,
          because that is what the page is opened for five minutes before a
          class. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GroupLessonCard
            group={group}
            classDate={classDate}
            planned={planned}
            lessons={lessons}
            busy={busy}
            run={run}
          />
        </div>

        <GroupScheduleCard group={group} busy={busy} run={run} />

        <div className="lg:col-span-2">
          <GroupRegisterCard
            group={group}
            classDate={classDate}
            onClassDateChange={setClassDate}
            planned={planned}
            students={students}
            onChanged={reload}
          />
        </div>

        {/* The record behind the register beside it. Clicking a class moves the
            register onto that day, so the two read as one panel in two halves.
            The page's own reload counter goes in: every write in the register
            bumps it, so the history follows without the two knowing about each
            other. */}
        <GroupAttendancePanel
          group={group}
          classDate={classDate}
          onPickDate={setClassDate}
          reloadKey={reloadKey}
        />
      </div>

    </div>
  );
}
