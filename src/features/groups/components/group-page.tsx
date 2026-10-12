import * as React from "react";
import { Link, useBlocker, useNavigate } from "@tanstack/react-router";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CalendarDaysIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  Trash2Icon,
  UserPlusIcon,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AddMemberDialog } from "@/features/groups/components/add-member-dialog";
import { GroupClassDateCard } from "@/features/groups/components/group-class-date-card";
import { GroupDetailsSheet } from "@/features/groups/components/group-details-sheet";
import {
  GroupLessonCard,
  type LessonSource,
} from "@/features/groups/components/group-lesson-card";
import { GroupModulePrompt } from "@/features/groups/components/group-module-prompt";
import { GroupStudioButton } from "@/features/groups/components/group-studio-button";
import {
  GroupRegisterTable,
  type RegisterRow,
} from "@/features/groups/components/group-register-table";
import {
  courseLessons,
  loadClassPlan,
  reflowPlan,
  setClassCancelled,
  type ClassPlan,
} from "@/features/groups/data/class-plan";
import {
  attendanceByStudent,
  deleteGroupClass,
  lastHeldClass,
  missedLessons,
  saveGroupClass,
  suggestNextLesson,
  type GroupClass,
  type Mark,
} from "@/features/groups/data/group-classes";
import {
  deleteGroup,
  fetchGroup,
  formatSchedule,
  formatTime,
  listGroupMembers,
  removeGroupStudent,
  setGroupLesson,
  setGroupStatus,
  today,
  type GroupMember,
  type GroupRow,
} from "@/features/groups/data/groups";
import {
  listModules,
  listStudents,
  type ModuleOption,
  type StudentRow,
} from "@/features/students/data/students";
import { useAuth } from "@/hooks/use-auth";
import { splitTitle } from "@/features/homepage/lib/class-title";
import { canUseAdvancedStudio } from "@/lib/profile";
import { listCloudLessons, type CloudLessonSummary } from "@/lib/lessons-cloud";

// The covers in the lesson sheet pull in the block registry; only load it once
// somebody opens the sheet.
const GroupLessonSheet = React.lazy(
  () => import("@/features/groups/components/group-lesson-sheet"),
);

/** The class as the form holds it, before it is saved. */
type Draft = {
  lessonId: string | null;
  /** "HH:MM", or "" for no time. */
  startsAt: string;
  /** studentId → mark. A student missing here is not marked. */
  marks: Record<string, Mark>;
};

function sameDraft(a: Draft, b: Draft): boolean {
  const aKeys = Object.keys(a.marks);
  return (
    a.lessonId === b.lessonId &&
    a.startsAt === b.startsAt &&
    aKeys.length === Object.keys(b.marks).length &&
    aKeys.every((key) => a.marks[key] === b.marks[key])
  );
}

const DISCARD_PROMPT = "You have changes to this class that aren’t saved. Discard them?";

/**
 * One group, as the register of one class: what it was for, when it happened,
 * and who was there — then Save.
 *
 * The class on the page is picked by its date. A day with a class recorded
 * opens that class, to read or correct; a day without one opens a new class,
 * with the lesson after the last class anybody came to already picked, and the
 * group's usual time filled in. Nothing is written until Save, and then all of
 * it at once — see `save_group_class` in 0028.
 *
 * Everything else about the group — its schedule, the days nobody recorded,
 * every class so far — is in a side sheet off the header, because none of it is
 * what the page is opened for five minutes before a class.
 */
export function GroupPage({ groupId }: { groupId: string }) {
  const navigate = useNavigate();

  const [group, setGroup] = React.useState<GroupRow | null>(null);
  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [lessons, setLessons] = React.useState<CloudLessonSummary[]>([]);
  const [modules, setModules] = React.useState<ModuleOption[]>([]);
  const [members, setMembers] = React.useState<GroupMember[]>([]);
  const [status, setStatus] = React.useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [plan, setPlan] = React.useState<ClassPlan | null>(null);
  const [planFailed, setPlanFailed] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const [classDate, setClassDate] = React.useState(today);
  // undefined: whichever class was recorded last on `classDate`, or a new one
  // if none was. null: a new class, chosen. A string: that class.
  const [chosenClassId, setChosenClassId] = React.useState<
    string | null | undefined
  >(undefined);
  // The form, tagged with the class it is a draft of — so moving to another
  // class drops it without an effect having to notice.
  const [draftState, setDraftState] = React.useState<{
    key: string;
    draft: Draft;
  } | null>(null);

  const [lessonSheetOpen, setLessonSheetOpen] = React.useState(false);
  const [lessonSheetMounted, setLessonSheetMounted] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [addingStudents, setAddingStudents] = React.useState(false);

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
      listGroupMembers(groupId),
    ])
      .then(([groupRow, studentRows, lessonRows, moduleRows, memberRows]) => {
        if (cancelled) return;
        setStudents(studentRows);
        setLessons(lessonRows);
        setModules(moduleRows);
        setMembers(memberRows);
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

  // The plan as the classes describe it — what has been taught, what is next,
  // which meeting days nobody recorded — with the plan's dates rewritten to
  // agree (see class-plan.ts). A failed rewrite still shows the plan as it
  // stands.
  const meetsKey = group?.meetsOn.join(",");
  const meetsOn = React.useMemo(
    () => (meetsKey ? meetsKey.split(",").map(Number) : []),
    [meetsKey],
  );
  const fetchPlan = React.useCallback(
    () =>
      reflowPlan(groupId, meetsOn, today()).catch(() =>
        loadClassPlan(groupId, meetsOn, today()),
      ),
    [groupId, meetsOn],
  );
  React.useEffect(() => {
    if (meetsKey === undefined) return;
    let cancelled = false;
    fetchPlan()
      .then((next) => {
        if (cancelled) return;
        setPlan(next);
        setPlanFailed(false);
      })
      .catch(() => {
        if (!cancelled) setPlanFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPlan, meetsKey, reloadKey]);

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

  // --- The course, and the suggestion -------------------------------------

  const course = React.useMemo(
    () => courseLessons(plan?.lessons ?? [], lessons, group?.moduleName ?? ""),
    [plan?.lessons, lessons, group?.moduleName],
  );
  const courseIds = React.useMemo(
    () => course.map((lesson) => lesson.lessonId),
    [course],
  );
  const classes = React.useMemo(() => plan?.classes ?? [], [plan?.classes]);
  const suggestedId = suggestNextLesson(courseIds, classes);
  const lastHeld = lastHeldClass(courseIds, classes);

  // The group's current lesson is the next one in its plan. Kept in step here
  // so the groups list and anything else reading the pointer agree with the
  // classes, without anybody having to move it by hand.
  const nextLessonId = plan?.next?.lessonId;
  const currentLessonId = group?.lessonId;
  React.useEffect(() => {
    if (!nextLessonId || nextLessonId === currentLessonId) return;
    setGroupLesson(groupId, nextLessonId).catch(() => {});
  }, [groupId, nextLessonId, currentLessonId]);

  // --- The class on the page ----------------------------------------------

  // Earliest first, as the day ran.
  const classesOnDate = React.useMemo(
    () => classes.filter((entry) => entry.classDate === classDate).reverse(),
    [classes, classDate],
  );
  const selectedClass: GroupClass | null =
    chosenClassId === undefined
      ? (classesOnDate.at(-1) ?? null)
      : chosenClassId === null
        ? null
        : (classes.find((entry) => entry.id === chosenClassId) ?? null);

  const baseline: Draft = selectedClass
    ? {
        lessonId: selectedClass.lessonId,
        startsAt: formatTime(selectedClass.startsAt),
        marks: Object.fromEntries(
          selectedClass.marks.map((entry) => [entry.studentId, entry.mark]),
        ),
      }
    : {
        lessonId: suggestedId,
        startsAt: formatTime(group?.startsAt ?? null),
        marks: {},
      };

  const draftKey = `${classDate}|${selectedClass?.id ?? "new"}`;
  const draft =
    draftState?.key === draftKey ? draftState.draft : baseline;
  const dirty = !sameDraft(draft, baseline);
  const edit = (change: (current: Draft) => Draft) =>
    setDraftState({ key: draftKey, draft: change(draft) });

  /** Moving off a class with unsaved changes asks first. */
  const leaveDraft = () => !dirty || window.confirm(DISCARD_PROMPT);

  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm(DISCARD_PROMPT),
    enableBeforeUnload: dirty,
  });

  /** Moves the page onto another class. False when the teacher chose to stay
   *  with unsaved changes. */
  const goTo = (date: string, classId: string | null | undefined) => {
    if (!leaveDraft()) return false;
    setClassDate(date);
    setChosenClassId(classId);
    setDraftState(null);
    return true;
  };

  // The record behind each name, from the saved classes only — what the form
  // holds isn't attendance until it is saved.
  const tallies = React.useMemo(() => attendanceByStudent(classes), [classes]);
  const missed = React.useMemo(() => missedLessons(classes), [classes]);

  const memberIds = new Set(members.map((member) => member.studentId));
  // Somebody marked in this class who has since left the group still has
  // their mark here — it is history, and can still be corrected.
  const former = (selectedClass?.marks ?? [])
    .filter((entry) => !memberIds.has(entry.studentId))
    .map((entry) => ({
      studentId: entry.studentId,
      name: entry.name,
      email: "",
      member: false,
    }));
  const rows: RegisterRow[] = [
    ...members.map((member) => ({ ...member, member: true })),
    ...former,
  ].map((student) => {
    const tally = tallies.get(student.studentId);
    return {
      ...student,
      mark: draft.marks[student.studentId] ?? null,
      rate: tally?.total ? tally.present / tally.total : null,
      sessions: tally?.total ?? 0,
      missed: missed.get(student.studentId) ?? [],
    };
  });

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
  // their own, say — is enough to say this group has been placed.
  const needsModule =
    !group.moduleId &&
    !students.some((student) => memberIds.has(student.id) && student.moduleId);

  const lessonTitle = (lessonId: string | null) => {
    if (!lessonId) return "";
    return (
      course.find((lesson) => lesson.lessonId === lessonId)?.title ||
      lessons.find((lesson) => lesson.id === lessonId)?.title ||
      (selectedClass?.lessonId === lessonId ? selectedClass.lessonTitle : "") ||
      lessonId
    );
  };

  const source: LessonSource = selectedClass
    ? draft.lessonId === selectedClass.lessonId
      ? "recorded"
      : "changed"
    : draft.lessonId === suggestedId
      ? "suggested"
      : "picked";
  const lastHeldTitle = lastHeld ? splitTitle(lastHeld.lessonTitle) : null;
  const sourceDetail =
    source !== "suggested"
      ? undefined
      : lastHeldTitle
        ? `after ${lastHeldTitle.label || lastHeldTitle.name}`
        : "first in the course";

  const save = () =>
    run(async () => {
      const id = await saveGroupClass({
        classId: selectedClass?.id ?? null,
        groupId: group.id,
        lessonId: draft.lessonId,
        classDate,
        startsAt: draft.startsAt,
        // Only who is on the register now: a student taken off the group
        // while the form was open isn't marked behind the teacher's back.
        marks: rows.flatMap((row) =>
          row.mark ? [{ studentId: row.studentId, mark: row.mark }] : [],
        ),
      });
      // The plan first, then the selection: pointing at the saved class before
      // it is in the list would flash an empty register in between.
      setPlan(await fetchPlan());
      setChosenClassId(id);
      setDraftState(null);
    });

  const removeClass = () => {
    if (!selectedClass) return;
    const id = selectedClass.id;
    void run(async () => {
      await deleteGroupClass(id);
      setPlan(await fetchPlan());
      setChosenClassId(undefined);
      setDraftState(null);
    });
  };

  const pendingCount = plan?.pending.length ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            {/* Montserrat rather than the page's Inter, and a size up: the
                group's name is the one thing on the page that is a name. */}
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

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDetailsOpen(true)}
            className="relative"
          >
            <CalendarDaysIcon />
            Schedule & history
            {/* The one thing in the sheet that needs doing: a meeting day
                nobody recorded. */}
            {pendingCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[0.625rem] font-semibold text-white"
                aria-label={`${pendingCount} classes not recorded`}
              >
                {pendingCount}
              </span>
            )}
          </Button>

          {studioAllowed && (
            <GroupStudioButton groupId={groupId} groupName={group.name} />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" disabled={busy}>
                <MoreHorizontalIcon />
                <span className="sr-only">Actions for {group.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Opens a dialog rendered beside the menu, not inside it — a
                  dialog inside a DropdownMenuItem unmounts when the menu
                  closes. */}
              <DropdownMenuItem onSelect={() => setAddingStudents(true)}>
                <UserPlusIcon />
                Add students
              </DropdownMenuItem>
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
                {group.status === "active" ? (
                  <ArchiveIcon />
                ) : (
                  <ArchiveRestoreIcon />
                )}
                {group.status === "active" ? "Archive group" : "Reactivate"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmingDelete(true)}
              >
                <Trash2Icon />
                Delete group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {group.name}?</DialogTitle>
            <DialogDescription>
              The group goes, and with it every class recorded for it and every
              copy made for it — presentations, student material and homework
              alike, including any advanced context added to them. The students
              stay on the roster, and the shared lessons are untouched.
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

      <AddMemberDialog
        open={addingStudents}
        onOpenChange={setAddingStudents}
        groupId={group.id}
        groupName={group.name}
        students={students}
        memberIds={memberIds}
        onAdd={reload}
      />

      {needsModule && (
        <GroupModulePrompt
          group={group}
          modules={modules}
          studentIds={[...memberIds]}
          busy={busy}
          run={run}
        />
      )}

      {planFailed && !plan ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-md border text-center">
          <p className="text-sm text-muted-foreground">
            Couldn’t load this group’s classes.
          </p>
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCwIcon />
            Try again
          </Button>
        </div>
      ) : !plan ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-40 lg:col-span-2" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64 lg:col-span-3" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GroupLessonCard
              group={group}
              lessonId={draft.lessonId}
              title={lessonTitle(draft.lessonId)}
              source={source}
              detail={sourceDetail}
              disabled={busy}
              onPick={() => {
                setLessonSheetMounted(true);
                setLessonSheetOpen(true);
              }}
            />
          </div>

          <GroupClassDateCard
            classDate={classDate}
            onDateChange={(date) => goTo(date, undefined)}
            startsAt={draft.startsAt}
            onStartsAtChange={(startsAt) =>
              edit((current) => ({ ...current, startsAt }))
            }
            classesOnDate={classesOnDate}
            selectedClassId={selectedClass?.id ?? null}
            onSelectClass={(classId) => goTo(classDate, classId)}
            disabled={busy}
          />

          <div className="lg:col-span-3">
            <GroupRegisterTable
              groupName={group.name}
              rows={rows}
              isNew={!selectedClass}
              dirty={dirty}
              busy={busy}
              onMark={(studentId, mark) =>
                edit((current) => {
                  const marks = { ...current.marks };
                  if (mark) marks[studentId] = mark;
                  else delete marks[studentId];
                  return { ...current, marks };
                })
              }
              onMarkAll={(mark) =>
                edit((current) => ({
                  ...current,
                  marks: Object.fromEntries(
                    rows.map((row) => [row.studentId, mark]),
                  ),
                }))
              }
              onSave={() => void save()}
              onDiscard={() => setDraftState(null)}
              onDelete={removeClass}
              onRemoveStudent={(studentId) =>
                void run(() => removeGroupStudent(group.id, studentId))
              }
            />
          </div>
        </div>
      )}

      {lessonSheetMounted && (
        <React.Suspense fallback={null}>
          <GroupLessonSheet
            open={lessonSheetOpen}
            onOpenChange={setLessonSheetOpen}
            groupName={group.name}
            lessons={course}
            value={draft.lessonId}
            suggestedId={selectedClass ? null : suggestedId}
            taughtOn={plan?.taughtOn ?? new Map()}
            onChoose={(lessonId) =>
              edit((current) => ({ ...current, lessonId }))
            }
          />
        </React.Suspense>
      )}

      <GroupDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        group={group}
        busy={busy}
        run={run}
        classes={classes}
        pending={plan?.pending ?? []}
        selectedClassId={selectedClass?.id ?? null}
        // Closing the sheet on the way, so the register is what is seen next.
        onOpenClass={(entry) => {
          if (goTo(entry.classDate, entry.id)) setDetailsOpen(false);
        }}
        onRecordDay={(date) => {
          if (goTo(date, null)) setDetailsOpen(false);
        }}
        onNoClass={(date) =>
          void run(() => setClassCancelled(group.id, date, true))
        }
      />
    </div>
  );
}
