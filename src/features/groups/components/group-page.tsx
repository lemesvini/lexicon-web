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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupAttendancePanel } from "@/features/groups/components/group-attendance-panel";
import { GroupLessonsTab } from "@/features/groups/components/group-lessons-tab";
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
import { listCloudLessons, type CloudLessonSummary } from "@/lib/lessons-cloud";

/** The tabs, and the value the URL carries. */
export const GROUP_TABS = ["register", "attendance", "lessons"] as const;
export type GroupTab = (typeof GROUP_TABS)[number];

/** Coerces whatever is in `?tab=` to a real tab. */
export function toGroupTab(value: unknown): GroupTab {
  return GROUP_TABS.includes(value as GroupTab)
    ? (value as GroupTab)
    : "register";
}

/**
 * One group, everything about it.
 *
 * The tab lives in the URL rather than in state so the back button, a reload and
 * a pasted link all land where they were pointed — the group page is now the
 * thing people link each other to, which the old selected-row board never was.
 *
 * `classDate` is owned here because two tabs move it: the register marks a day,
 * and clicking a class in the history jumps the register onto that day. Two
 * controls on one date only agree if neither of them owns it.
 */
export function GroupPage({
  groupId,
  tab,
}: {
  groupId: string;
  tab: GroupTab;
}) {
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

  const setTab = (next: string) =>
    void navigate({
      to: "/groups/$groupId",
      params: { groupId },
      search: { tab: toGroupTab(next) },
      replace: true,
    });

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
              The group goes, and with it its attendance record and every copy of
              a lesson made for it — including any advanced context added to
              those copies. The students stay on the roster, and the shared
              lessons are untouched.
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

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="register" className="px-3">
            Register
          </TabsTrigger>
          <TabsTrigger value="attendance" className="px-3">
            Attendance
          </TabsTrigger>
          <TabsTrigger value="lessons" className="px-3">
            Lessons
          </TabsTrigger>
        </TabsList>

        <TabsContent value="register">
          <GroupRegisterTab
            group={group}
            classDate={classDate}
            onClassDateChange={setClassDate}
            lessons={lessons}
            students={students}
            onChanged={reload}
          />
        </TabsContent>

        <TabsContent value="attendance">
          <GroupAttendancePanel
            group={group}
            classDate={classDate}
            // Picking a class is asking to see who was in it, so it moves the
            // register and follows you there.
            onPickDate={(date) => {
              setClassDate(date);
              setTab("register");
            }}
            // The page's own reload counter: every write in the register bumps
            // it, so the history follows without the two tabs knowing about
            // each other.
            reloadKey={reloadKey}
          />
        </TabsContent>

        <TabsContent value="lessons">
          <GroupLessonsTab
            group={group}
            lessons={lessons}
            onChanged={reload}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
