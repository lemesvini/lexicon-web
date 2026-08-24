import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  CheckIcon,
  MoreHorizontalIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  SparklesIcon,
  TabletIcon,
  Trash2Icon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { canUseAdvancedStudio } from "@/lib/profile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addGroupLessons,
  listGroupLessons,
  regenerateDates,
  removeGroupLesson,
  setGroupLessonDate,
  type GroupLessonRow,
} from "@/features/groups/data/group-lessons";
import {
  fromDateKey,
  setGroupLesson,
  setGroupModule,
  today,
  type GroupRow,
} from "@/features/groups/data/groups";
import { listModuleOverview, type ModuleRow } from "@/features/modules/data/modules";
import type { CloudLessonSummary } from "@/lib/lessons-cloud";

const NO_MODULE_VALUE = "none";

const plannedFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** The planned date as the row reads it. Spelled out rather than left as
 *  "2026-08-25": the thing being checked at a glance is which weekday it lands
 *  on, and that is exactly what an ISO string hides. */
function formatPlanned(dateKey: string | null): string {
  return dateKey ? plannedFormat.format(fromDateKey(dateKey)) : "No date set";
}

/**
 * The Lessons tab: the module this group is working through, as their own
 * editable copies.
 *
 * Assigning a module copies its lessons — it does not point at them. That is the
 * whole feature: a copy can carry blocks that exist for this class and nowhere
 * else. The cost is that copies drift from the lesson they came from, which is
 * what the "Base updated" badge and the studio's Refresh from base are for.
 *
 * Nothing here ever removes a copy on its own. Changing the module adds the new
 * one's lessons and leaves the old ones alone; adding twice is a no-op. Removing
 * is one row at a time, confirmed, because the document may hold work that is
 * only there.
 */
export function GroupLessonsTab({
  group,
  lessons,
  onChanged,
}: {
  group: GroupRow;
  /** Every cloud lesson, so this tab can work out what the chosen module has
   *  that the group hasn't copied yet. */
  lessons: CloudLessonSummary[];
  /** Called after a write the page header also reflects (the current lesson). */
  onChanged: () => void;
}) {
  // The advanced editor is a per-teacher permission the admin grants; hide the
  // way in for anyone without it (the route guard is what enforces it).
  const advancedAllowed = canUseAdvancedStudio(useAuth().profile);
  const [rows, setRows] = React.useState<GroupLessonRow[]>([]);
  const [modules, setModules] = React.useState<ModuleRow[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [moduleId, setModuleId] = React.useState(group.moduleId ?? "");
  const [startDate, setStartDate] = React.useState(today);
  const [removing, setRemoving] = React.useState<GroupLessonRow | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([listGroupLessons(group.id), listModuleOverview()])
      .then(([lessonRows, overview]) => {
        if (cancelled) return;
        setRows(lessonRows);
        setModules(overview.modules);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [group.id, reloadKey]);

  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

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

  const chosenModule = modules.find((module) => module.id === moduleId);

  // Lessons belong to a module by *name*, not by a foreign key (see
  // features/modules/data/modules.ts) — so the filter is on the text column.
  const moduleLessons = React.useMemo(
    () =>
      chosenModule
        ? lessons.filter((lesson) => lesson.module.trim() === chosenModule.name)
        : [],
    [lessons, chosenModule],
  );

  const copied = React.useMemo(
    () => new Set(rows.map((row) => row.lessonId)),
    [rows],
  );

  const missing = moduleLessons.filter((lesson) => !copied.has(lesson.id));

  if (status === "loading") {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
        <p className="text-sm text-muted-foreground">
          Couldn’t load this group’s lessons.
        </p>
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Assigning a module */}
      <section className="rounded-md border p-4">
        <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <div className="space-y-2">
            <Label htmlFor="group-module">Module</Label>
            <Select
              value={moduleId || NO_MODULE_VALUE}
              onValueChange={(value) => {
                const next = value === NO_MODULE_VALUE ? "" : value;
                setModuleId(next);
                void run(() => setGroupModule(group.id, next || null));
              }}
            >
              <SelectTrigger id="group-module" className="w-full">
                <SelectValue placeholder="Pick a module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MODULE_VALUE}>No module set</SelectItem>
                {modules.map((module) => (
                  <SelectItem key={module.id} value={module.id}>
                    {module.name}
                    {module.isActive ? "" : " (inactive)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-start-date">Starting</Label>
            <Input
              id="group-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <Button
            disabled={busy || missing.length === 0}
            onClick={() =>
              void run(async () => {
                await addGroupLessons(group.id, missing, {
                  meetsOn: group.meetsOn,
                  startDate,
                });
              })
            }
          >
            <PlusIcon />
            {missing.length === 0
              ? "Nothing to add"
              : `Add ${missing.length} lesson${missing.length === 1 ? "" : "s"}`}
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {group.meetsOn.length === 0
            ? "This group has no meeting days set, so lessons are added without dates. Set them on the Register tab to get a schedule."
            : "Dates are laid out on the days this group meets, starting from the date above. Adjust any of them afterwards."}
        </p>
      </section>

      {/* The copies */}
      <section className="rounded-md border">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-medium">
            {rows.length} lesson{rows.length === 1 ? "" : "s"} for this group
          </h2>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || rows.length === 0 || group.meetsOn.length === 0}
            onClick={() => {
              if (
                !window.confirm(
                  "Re-space every date from the start date above? Any date you set by hand is overwritten.",
                )
              ) {
                return;
              }
              void run(() =>
                regenerateDates(group.id, group.meetsOn, startDate),
              );
            }}
          >
            <CalendarPlusIcon />
            Re-generate dates
          </Button>
        </header>

        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No lessons copied yet. Pick a module above and add its lessons — this
            group gets its own editable copy of each one.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((row, index) => {
              const isCurrent = row.lessonId === group.lessonId;
              const name = row.title || row.lessonId;

              return (
                <li
                  key={row.id}
                  className={cn(
                    "group/row flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/40",
                    isCurrent && "bg-primary/[0.04]",
                  )}
                >
                  {/* The running order, and whether this is the one being taught
                      — one column doing two jobs, because they are the same
                      question asked at two scales. */}
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                    title={isCurrent ? "The lesson this group is on" : undefined}
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {name}
                      </span>
                      {row.advancedCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="gap-1 border-primary/30 bg-primary/10 text-primary"
                        >
                          <SparklesIcon className="size-3" />
                          {row.advancedCount}
                        </Badge>
                      )}
                      {row.baseIsNewer && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 text-amber-600 dark:text-amber-400"
                          title="The shared lesson has changed since this copy was made"
                        >
                          Base updated
                        </Badge>
                      )}
                    </div>

                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate text-xs text-muted-foreground">
                      <CalendarDaysIcon className="size-3 shrink-0" />
                      <span
                        className={cn(
                          "tabular-nums",
                          !row.scheduledOn && "italic",
                        )}
                      >
                        {formatPlanned(row.scheduledOn)}
                      </span>
                      {[row.unit, row.module].filter(Boolean).length > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="truncate">
                            {[row.unit, row.module].filter(Boolean).join(" · ")}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {/* Control then play, the order they are in everywhere else
                        in the app. Both carry `groupId`, which is the whole
                        point of running them from here: they open THIS group's
                        copy, advanced context and all, rather than the lesson
                        every other class gets. */}
                    <div className="flex items-center">
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          to="/control/$lessonId"
                          params={{ lessonId: row.lessonId }}
                          search={{ groupId: group.id }}
                          aria-label={`Control ${name} for ${group.name}`}
                          title="Control from your device"
                        >
                          <TabletIcon />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          to="/present/$lessonId"
                          params={{ lessonId: row.lessonId }}
                          search={{ groupId: group.id }}
                          aria-label={`Present ${name} to ${group.name}`}
                          title="Present"
                        >
                          <PlayIcon />
                        </Link>
                      </Button>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={busy}>
                          <MoreHorizontalIcon />
                          <span className="sr-only">Options for {name}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        {/* A plain field rather than a menu item, and the
                            `stopPropagation` is what makes it usable: the menu's
                            own typeahead swallows printable keys, so without it
                            the date can be picked from the calendar but never
                            typed. */}
                        <div
                          className="px-2 py-1.5"
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Label
                            htmlFor={`date-${row.id}`}
                            className="mb-1.5 text-xs text-muted-foreground"
                          >
                            Planned date
                          </Label>
                          <Input
                            id={`date-${row.id}`}
                            type="date"
                            className="w-full"
                            value={row.scheduledOn ?? ""}
                            disabled={busy}
                            // Saved as soon as the value is a whole date. A
                            // half-typed one ("2026-08-") is not a date the
                            // column would take, and writing it would be a
                            // rejected round trip per keystroke.
                            onChange={(event) => {
                              const next = event.target.value;
                              if (next !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(next)) {
                                return;
                              }
                              if ((next || null) === row.scheduledOn) return;
                              void run(() =>
                                setGroupLessonDate(row.id, next || null),
                              );
                            }}
                          />
                        </div>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          disabled={busy || isCurrent}
                          onSelect={() =>
                            void run(() => setGroupLesson(group.id, row.lessonId))
                          }
                        >
                          <CheckIcon />
                          {isCurrent ? "This is the current lesson" : "Set as current"}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setRemoving(row)}
                        >
                          <Trash2Icon />
                          Remove from this group
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {advancedAllowed && (
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        to="/studio/advanced/$groupId/$lessonId"
                        params={{ groupId: group.id, lessonId: row.lessonId }}
                      >
                        <SparklesIcon />
                        Advanced Context
                      </Link>
                    </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {missing.length > 0 && rows.length > 0 && (
          <footer className="border-t px-4 py-3">
            <p className="mb-2 text-xs text-muted-foreground">
              In {chosenModule?.name}, not yet copied here:
            </p>
            <ul className="flex flex-wrap gap-2">
              {missing.map((lesson) => (
                <li key={lesson.id}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await addGroupLessons(group.id, [lesson]);
                      })
                    }
                  >
                    <PlusIcon />
                    {lesson.title || lesson.id}
                  </Button>
                </li>
              ))}
            </ul>
          </footer>
        )}
      </section>

      <Dialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {removing?.title || "this lesson"} from {group.name}?
            </DialogTitle>
            <DialogDescription>
              This group’s copy goes with it
              {removing && removing.advancedCount > 0
                ? `, including the ${removing.advancedCount} block${
                    removing.advancedCount === 1 ? "" : "s"
                  } of advanced context added to it — which exist nowhere else.`
                : ". The shared lesson itself is untouched."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRemoving(null)}
              disabled={busy}
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => {
                const row = removing;
                setRemoving(null);
                if (row) void run(() => removeGroupLesson(row.id));
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
