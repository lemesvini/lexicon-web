import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { AddGroupDialog } from "@/features/groups/components/add-group-dialog";
import {
  formatSchedule,
  listGroups,
  type GroupRow,
} from "@/features/groups/data/groups";
import {
  listTeacherOptions,
  type TeacherOption,
} from "@/features/students/data/students";
import { listCloudLessons, type CloudLessonSummary } from "@/lib/lessons-cloud";

type Filter = "active" | "all";

/** An attendance share as a column reads it. Null before anything is recorded —
 *  0% would be a lie about a class that hasn't happened. */
function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/**
 * Every group the caller can see. Clicking one opens its own page.
 *
 * This used to be one column of a three-column board that also held the register
 * and the attendance history. It stopped fitting: a group now carries its own
 * copies of a module's lessons, and none of that belongs in a rail beside a list.
 * So the list is a list, and the group is a page.
 *
 * Which groups appear is decided in the database: the admin sees every group, a
 * teacher sees their own (see 0007).
 */
export function GroupsList() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = React.useState<GroupRow[]>([]);
  const [teachers, setTeachers] = React.useState<TeacherOption[]>([]);
  const [lessons, setLessons] = React.useState<CloudLessonSummary[]>([]);
  const [filter, setFilter] = React.useState<Filter>("active");
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    // Teachers and lessons are their own queries rather than being derived from
    // the groups: each is a list of what a *new* group could have, which is
    // exactly the part the existing rows can't tell you.
    Promise.all([listGroups(), listTeacherOptions(), listCloudLessons()])
      .then(([groupRows, teacherOptions, lessonRows]) => {
        if (cancelled) return;
        setGroups(groupRows);
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

  const refresh = () => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  };

  const visible =
    filter === "all"
      ? groups
      : groups.filter((group) => group.status === "active");

  const archivedCount = groups.filter(
    (group) => group.status === "inactive",
  ).length;

  if (status === "loading") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
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

  return (
    <div className="rounded-md border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2 pr-2 pl-4">
        <h2 className="text-sm font-medium">
          {visible.length} group{visible.length === 1 ? "" : "s"}
        </h2>

        <div className="flex items-center gap-2">
          {archivedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={filter === "all"}
              onClick={() =>
                setFilter((f) => (f === "all" ? "active" : "all"))
              }
            >
              {filter === "all"
                ? "Hide archived"
                : `Show archived (${archivedCount})`}
            </Button>
          )}
          <AddGroupDialog
            teachers={teachers}
            currentTeacherId={profile?.id ?? ""}
            lessons={lessons}
            // Straight into the new group: the next thing anyone does after
            // creating one is put students in it.
            onCreated={(groupId) =>
              void navigate({
                to: "/groups/$groupId",
                params: { groupId },
                search: { tab: "register" },
              })
            }
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          {groups.length === 0
            ? "No groups yet. Start one to keep a register."
            : "No active groups. Show the archived ones to find yours."}
        </p>
      ) : (
        <ul className="divide-y">
          {visible.map((group) => (
            <li key={group.id}>
              <Link
                to="/groups/$groupId"
                params={{ groupId: group.id }}
                search={{ tab: "register" }}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent",
                  group.status === "inactive" && "opacity-60",
                )}
              >
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex items-baseline gap-2">
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
                    {[
                      group.teacher,
                      formatSchedule(group),
                      group.moduleName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {group.lessonTitle || "No lesson set"}
                  </span>
                </span>

                <span className="shrink-0 text-right text-xs text-muted-foreground">
                  <span className="block text-sm tabular-nums text-foreground">
                    {group.memberCount}
                  </span>
                  student{group.memberCount === 1 ? "" : "s"}
                </span>

                <span
                  className="w-14 shrink-0 text-right text-sm tabular-nums text-muted-foreground"
                  title="Attendance across every class recorded"
                >
                  {formatRate(group.attendanceRate)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
