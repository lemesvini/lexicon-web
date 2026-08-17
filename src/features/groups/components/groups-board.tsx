import * as React from "react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { AddGroupDialog } from "@/features/groups/components/add-group-dialog";
import { GroupAttendancePanel } from "@/features/groups/components/group-attendance-panel";
import { GroupRegister } from "@/features/groups/components/group-register";
import {
  formatSchedule,
  listGroups,
  today,
  type GroupRow,
} from "@/features/groups/data/groups";
import {
  listStudents,
  listTeacherOptions,
  type StudentRow,
  type TeacherOption,
} from "@/features/students/data/students";
import { listCloudLessons, type CloudLessonSummary } from "@/lib/lessons-cloud";

/**
 * The groups screen: a short list of groups on the left, and the selected one's
 * register on the right.
 *
 * Two panels rather than a table, because a group is not really a row — the
 * thing you came to do is take one group's register, and a table would make that
 * an expand-then-scroll rather than a click.
 *
 * Which groups appear is decided in the database: the admin sees every group, a
 * teacher sees their own (see 0007).
 */
export function GroupsBoard() {
  const { profile } = useAuth();

  const [groups, setGroups] = React.useState<GroupRow[]>([]);
  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [teachers, setTeachers] = React.useState<TeacherOption[]>([]);
  const [lessons, setLessons] = React.useState<CloudLessonSummary[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [classDate, setClassDate] = React.useState(today);
  const [attendanceOpen, setAttendanceOpen] = React.useState(false);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    // The students, teachers and lessons are their own queries rather than being
    // derived from the groups: each one is a list of what a group *could* have,
    // which is exactly the part the existing rows can't tell you.
    Promise.all([
      listGroups(),
      listStudents(),
      listTeacherOptions(),
      listCloudLessons(),
    ])
      .then(([groupRows, studentRows, teacherOptions, lessonRows]) => {
        if (cancelled) return;
        setGroups(groupRows);
        setStudents(studentRows);
        setTeachers(teacherOptions);
        setLessons(lessonRows);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

  const refresh = () => {
    setStatus("loading");
    reload();
  };

  // Falls back to the first group whenever the selection no longer exists —
  // on first load, and after the selected group is deleted.
  const selected =
    groups.find((group) => group.id === selectedId) ?? groups[0] ?? null;

  /** Switching group starts the register on today again: a date picked while
   *  looking at one class says nothing about the next one. */
  const selectGroup = (groupId: string) => {
    setSelectedId(groupId);
    setClassDate(today());
  };

  if (status === "loading") {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
        <p className="text-sm text-muted-foreground">Couldn’t load the groups.</p>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCwIcon />
          Try again
        </Button>
      </div>
    );
  }

  // Spelled out either side of the ternary rather than interpolated, because
  // Tailwind only ships the classes it can literally see in the source.
  const columns = attendanceOpen
    ? "lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,17rem)]"
    : "lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]";

  return (
    <div className={cn("grid items-start gap-6", columns)}>
      <aside className="rounded-md border">
        <div className="flex items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
          <h2 className="text-sm font-medium">
            {groups.length} group{groups.length === 1 ? "" : "s"}
          </h2>
          <AddGroupDialog
            teachers={teachers}
            currentTeacherId={profile?.id ?? ""}
            lessons={lessons}
            onCreated={(groupId) => {
              selectGroup(groupId);
              reload();
            }}
          />
        </div>

        {groups.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No groups yet. Start one to keep a register.
          </p>
        ) : (
          <ul className="divide-y">
            {groups.map((group) => {
              const isSelected = group.id === selected?.id;
              return (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => selectGroup(group.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "w-full space-y-0.5 px-4 py-3 text-left transition-colors hover:bg-accent",
                      isSelected && "bg-accent",
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {group.name}
                      </span>
                      {group.status === "inactive" && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {group.memberCount} student
                      {group.memberCount === 1 ? "" : "s"}
                      {formatSchedule(group) && ` · ${formatSchedule(group)}`}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {group.lessonTitle || "No lesson set"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {selected ? (
        <GroupRegister
          // Keyed on the group so the panel's transient state — an open confirm,
          // a half-finished action — doesn't follow you to the next one.
          key={selected.id}
          group={selected}
          classDate={classDate}
          onClassDateChange={setClassDate}
          lessons={lessons}
          students={students}
          attendanceOpen={attendanceOpen}
          onToggleAttendance={() => setAttendanceOpen((open) => !open)}
          onChanged={reload}
        />
      ) : (
        <section className="flex h-48 items-center justify-center rounded-md border">
          <p className="text-sm text-muted-foreground">
            Pick a group, or start one.
          </p>
        </section>
      )}

      {selected && attendanceOpen && (
        <GroupAttendancePanel
          key={selected.id}
          group={selected}
          classDate={classDate}
          onPickDate={setClassDate}
          onClose={() => setAttendanceOpen(false)}
          // The board's own reload counter: every write in the register calls
          // `onChanged`, which bumps it, so the history follows the register
          // without the two panels having to know about each other.
          reloadKey={reloadKey}
        />
      )}
    </div>
  );
}
