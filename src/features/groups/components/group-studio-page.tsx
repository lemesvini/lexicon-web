import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpenIcon,
  CalendarDaysIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  MonitorPlayIcon,
  MoreHorizontalIcon,
  NotebookPenIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
  TabletIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { listCloudLessons, type CloudLessonSummary } from "@/lib/lessons-cloud";
import {
  LibraryViewToggle,
  type LibraryView,
} from "@/features/studio/components/library-view-toggle";
import {
  listGroupLessons,
  removeGroupLesson,
  setGroupLessonDate,
  type GroupLessonRow,
} from "@/features/groups/data/group-lessons";
import {
  addGroupHomework,
  addGroupMaterials,
  listGroupHomework,
  listGroupMaterials,
  removeGroupHomework,
  removeGroupMaterial,
  setGroupHomeworkStatus,
  setGroupMaterialStatus,
  type GroupHomeworkRow,
  type GroupMaterialRow,
} from "@/features/groups/data/group-content";
import {
  fetchGroup,
  fromDateKey,
  listGroupContexts,
  setGroupLesson,
  today,
  type GroupRow,
  type GroupStudentContext,
} from "@/features/groups/data/groups";
import {
  listHomework,
  type HomeworkSummary,
} from "@/features/studio/data/homework";
import {
  listModuleOverview,
  type ModuleRow,
} from "@/features/modules/data/modules";
import type { PublishStatus } from "@/features/studio/data/publishing";
import { GroupStudioCard } from "./group-plan-card";
import {
  GroupHomeworkGallery,
  GroupLessonGallery,
  GroupMaterialGallery,
} from "./group-studio-gallery";

/** The three things a group can have its own copy of. */
type StudioTab = "lesson" | "material" | "homework";

/** Where the chosen view is remembered — the same bargain the main library's
 *  toggle makes: how you like to read a list is not a per-visit question. */
const VIEW_KEY = "studio:group-view";

function readViewPreference(): LibraryView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "gallery"
      ? "gallery"
      : "table";
  } catch {
    // Private mode, blocked storage — not a reason to fail to draw the page.
    return "table";
  }
}

const TABS: readonly {
  tab: StudioTab;
  label: string;
  icon: LucideIcon;
  /** One line under the tab: who reads this kind, and what a copy changes. */
  hint: string;
}[] = [
  {
    tab: "lesson",
    label: "Presentations",
    icon: MonitorPlayIcon,
    hint: "What you project. Every lesson in this group's module is already a copy — add blocks and only this class sees them.",
  },
  {
    tab: "material",
    label: "Student material",
    icon: BookOpenIcon,
    hint: "What this group reads on their own device. A published copy replaces the shared material for them, and nobody else.",
  },
  {
    tab: "homework",
    label: "Homework",
    icon: NotebookPenIcon,
    hint: "What this group hands in. Their answers are marked against their copy, so a changed exercise still marks correctly.",
  },
];

const plannedFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** The planned date as a row reads it. Spelled out rather than left as
 *  "2026-08-25": the thing being checked at a glance is which weekday it lands
 *  on, and that is exactly what an ISO string hides. */
function formatPlanned(dateKey: string | null): string {
  return dateKey ? plannedFormat.format(fromDateKey(dateKey)) : "No date set";
}

/**
 * A group's Studio: everything this class is taught from, as this class's own
 * copies.
 *
 * This is where a group's curriculum now lives — the module they are working
 * through, the dates it falls on, and the three documents each class produces.
 * Assigning a module copies its lessons rather than pointing at them, which is
 * the whole feature: a copy can carry blocks that exist for this class and
 * nowhere else.
 *
 * The presentation copies are made for you by the plan above. The other two are
 * made on purpose, one at a time: a copy is a promise to keep it up to date, and
 * most groups read the shared version quite happily.
 */
export function GroupStudioPage({ groupId }: { groupId: string }) {
  const [group, setGroup] = React.useState<GroupRow | null>(null);
  const [lessons, setLessons] = React.useState<GroupLessonRow[]>([]);
  const [materials, setMaterials] = React.useState<GroupMaterialRow[]>([]);
  const [homework, setHomework] = React.useState<GroupHomeworkRow[]>([]);
  const [baseHomework, setBaseHomework] = React.useState<HomeworkSummary[]>([]);
  const [cloudLessons, setCloudLessons] = React.useState<CloudLessonSummary[]>(
    [],
  );
  const [modules, setModules] = React.useState<ModuleRow[]>([]);
  const [students, setStudents] = React.useState<GroupStudentContext[]>([]);
  // The module and the start date are the header's, not the Presentations
  // tab's: every tab below is a view of the module this group is working
  // through. The module follows the group row on every reload — the select
  // writes it straight through, so the two never disagree for long.
  const [moduleId, setModuleId] = React.useState("");
  const [startDate, setStartDate] = React.useState(today);
  const [status, setStatus] = React.useState<
    "loading" | "ready" | "missing" | "error"
  >("loading");
  const [reloadKey, setReloadKey] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [view, setView] = React.useState<LibraryView>(readViewPreference);
  const [removing, setRemoving] = React.useState<{
    kind: StudioTab;
    id: string;
    title: string;
    advancedCount: number;
  } | null>(null);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      // See readViewPreference — the toggle still works for this session.
    }
  }, [view]);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchGroup(groupId),
      listGroupLessons(groupId),
      listGroupMaterials(groupId),
      listGroupHomework(groupId),
      listHomework(),
      listCloudLessons(),
      listModuleOverview(),
      listGroupContexts(groupId),
    ])
      .then(
        ([
          groupRow,
          lessonRows,
          materialRows,
          homeworkRows,
          allHomework,
          allLessons,
          overview,
          studentRows,
        ]) => {
          if (cancelled) return;
          if (!groupRow) {
            setStatus("missing");
            return;
          }
          setGroup(groupRow);
          setModules(overview.modules);
          setModuleId(groupRow.moduleId ?? "");
          setStudents(studentRows);
          setLessons(lessonRows);
          setMaterials(materialRows);
          setHomework(homeworkRows);
          setBaseHomework(allHomework);
          setCloudLessons(allLessons);
          setStatus("ready");
        },
      )
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [groupId, reloadKey]);

  const refresh = React.useCallback(() => setReloadKey((k) => k + 1), []);

  const run = React.useCallback((action: () => Promise<void>) => {
    void (async () => {
      setBusy(true);
      try {
        await action();
        setReloadKey((k) => k + 1);
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  // Lessons belong to a module by *name*, not by a foreign key (see
  // features/modules/data/modules.ts) — so the match is on the text column.
  const chosenModule = modules.find((module) => module.id === moduleId);

  const moduleLessons = React.useMemo(
    () =>
      chosenModule
        ? cloudLessons.filter(
            (lesson) => lesson.module.trim() === chosenModule.name,
          )
        : [],
    [chosenModule, cloudLessons],
  );

  const missing = React.useMemo(() => {
    const copied = new Set(lessons.map((row) => row.lessonId));
    return moduleLessons.filter((lesson) => !copied.has(lesson.id));
  }, [moduleLessons, lessons]);

  // What this group could copy but hasn't. Both lists are drawn from the
  // group's own lessons rather than from the whole library: a copy of something
  // this class is not being taught is not a thing anyone wants.
  const lessonIds = React.useMemo(
    () => new Set(lessons.map((row) => row.lessonId)),
    [lessons],
  );

  const uncopiedMaterials = React.useMemo(() => {
    const copied = new Set(materials.map((row) => row.lessonId));
    return lessons.filter((row) => !copied.has(row.lessonId));
  }, [lessons, materials]);

  const uncopiedHomework = React.useMemo(() => {
    const copied = new Set(homework.map((row) => row.homeworkId));
    return baseHomework.filter(
      (task) =>
        task.lessonId !== null &&
        lessonIds.has(task.lessonId) &&
        !copied.has(task.id),
    );
  }, [baseHomework, homework, lessonIds]);

  if (status === "loading") {
    return (
      <Shell>
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Shell>
    );
  }

  if (status !== "ready" || !group) {
    return (
      <Shell>
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-md border text-center">
        <p className="text-sm text-muted-foreground">
          {status === "missing"
            ? "There’s no group here — it may have been deleted, or it isn’t yours."
            : "Couldn’t load this group’s studio."}
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
                setReloadKey((k) => k + 1);
              }}
            >
              <RefreshCwIcon />
              Try again
            </Button>
          )}
        </div>
        </div>
      </Shell>
    );
  }

  const counts: Record<StudioTab, number> = {
    lesson: lessons.length,
    material: materials.length,
    homework: homework.length,
  };

  return (
    <Shell groupName={group.name}>
      <div className="space-y-6">
      {/* The bar says GroupStudio; this says which group. The two are not the
          same sentence — the bar names the room you are in, and a page still
          wants a title you can read without looking up. */}
      <h1 className="font-montserrat text-4xl leading-none font-bold text-primary">
        {group.name}
      </h1>

      <GroupStudioCard
        group={group}
        students={students}
        rows={lessons}
        missing={missing}
        modules={modules}
        moduleId={moduleId}
        classCount={moduleLessons.length}
        onModuleChange={setModuleId}
        startDate={startDate}
        onStartDateChange={setStartDate}
        busy={busy}
        run={run}
        onChanged={refresh}
      />

      <Tabs defaultValue="lesson" className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            {TABS.map(({ tab, label }) => (
              <TabsTrigger key={tab} value={tab} className="px-3">
                {label}
                <span className="tabular-nums text-muted-foreground">
                  {counts[tab]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          <LibraryViewToggle value={view} onValueChange={setView} />
        </div>

        <TabsContent value="lesson" className="space-y-4">
          <Hint tab="lesson" />

          {view === "gallery" ? (
            <GroupLessonGallery
              groupId={groupId}
              rows={lessons}
              currentLessonId={group.lessonId}
              plannedDate={(row) => formatPlanned(row.scheduledOn)}
            />
          ) : lessons.length === 0 ? (
            <Empty>
              No lessons copied yet. Pick a module above and add its lessons —
              this group gets its own editable copy of each one.
            </Empty>
          ) : (
            <ul className="divide-y rounded-md border">
              {lessons.map((row, index) => {
                const isCurrent = row.lessonId === group.lessonId;
                const name = row.title || row.lessonId;

                return (
                  <CopyRow
                    key={row.id}
                    index={index + 1}
                    highlighted={isCurrent}
                    title={name}
                    subtitle={
                      <>
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
                              {[row.unit, row.module]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </>
                        )}
                      </>
                    }
                    advancedCount={row.advancedCount}
                    baseIsNewer={row.baseIsNewer}
                    badges={
                      isCurrent ? (
                        <Badge variant="secondary">Current</Badge>
                      ) : null
                    }
                    before={
                      // Control then play, the order they are in everywhere
                      // else in the app. Both carry `groupId`, which is the
                      // point of running them from here: they open THIS
                      // group's copy, advanced context and all.
                      <div className="flex items-center">
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            to="/control/$lessonId"
                            params={{ lessonId: row.lessonId }}
                            search={{ groupId }}
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
                            search={{ groupId }}
                            aria-label={`Present ${name} to ${group.name}`}
                            title="Present"
                          >
                            <PlayIcon />
                          </Link>
                        </Button>
                      </div>
                    }
                    edit={
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          to="/studio/advanced/$groupId/$lessonId"
                          params={{ groupId, lessonId: row.lessonId }}
                        >
                          <PencilIcon />
                          Edit
                        </Link>
                      </Button>
                    }
                    menu={
                      <>
                        {/* A plain field rather than a menu item, and the
                            `stopPropagation` is what makes it usable: the
                            menu's own typeahead swallows printable keys, so
                            without it the date can be picked from the calendar
                            but never typed. */}
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
                              if (
                                next !== "" &&
                                !/^\d{4}-\d{2}-\d{2}$/.test(next)
                              ) {
                                return;
                              }
                              if ((next || null) === row.scheduledOn) return;
                              run(() => setGroupLessonDate(row.id, next || null));
                            }}
                          />
                        </div>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          disabled={busy || isCurrent}
                          onSelect={() =>
                            run(() => setGroupLesson(groupId, row.lessonId))
                          }
                        >
                          <CheckIcon />
                          {isCurrent
                            ? "This is the current lesson"
                            : "Set as current"}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            setRemoving({
                              kind: "lesson",
                              id: row.id,
                              title: name,
                              advancedCount: row.advancedCount,
                            })
                          }
                        >
                          <Trash2Icon />
                          Remove from this group
                        </DropdownMenuItem>
                      </>
                    }
                  />
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="material" className="space-y-4">
          <Hint tab="material" />

          {view === "gallery" ? (
            <GroupMaterialGallery groupId={groupId} rows={materials} />
          ) : materials.length === 0 ? (
            <Empty>
              This group reads the shared material. Copy one below to write a
              version only they get.
            </Empty>
          ) : (
            <ul className="divide-y rounded-md border">
              {materials.map((row) => (
                <CopyRow
                  key={row.id}
                  title={row.title || row.lessonId}
                  subtitle={[row.unit, row.module].filter(Boolean).join(" · ")}
                  advancedCount={row.advancedCount}
                  baseIsNewer={row.baseIsNewer}
                  badges={<StatusBadge status={row.status} />}
                  edit={
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        to="/studio/group/$groupId/material/$lessonId"
                        params={{ groupId, lessonId: row.lessonId }}
                      >
                        <PencilIcon />
                        Edit
                      </Link>
                    </Button>
                  }
                  menu={
                    <>
                      <PublishItem
                        status={row.status}
                        busy={busy}
                        onSelect={(next) =>
                          run(() => setGroupMaterialStatus(row.id, next))
                        }
                      />
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          setRemoving({
                            kind: "material",
                            id: row.id,
                            title: row.title || row.lessonId,
                            advancedCount: row.advancedCount,
                          })
                        }
                      >
                        <Trash2Icon />
                        Drop this copy
                      </DropdownMenuItem>
                    </>
                  }
                />
              ))}
            </ul>
          )}

          <Uncopied
            label="Lessons this group has, without their own material:"
            empty="Every lesson this group has already has its own material."
            items={uncopiedMaterials.map((row) => ({
              key: row.lessonId,
              label: row.title || row.lessonId,
            }))}
            busy={busy}
            onAdd={(lessonId) =>
              run(async () => {
                await addGroupMaterials(groupId, [lessonId]);
              })
            }
          />
        </TabsContent>

        <TabsContent value="homework" className="space-y-4">
          <Hint tab="homework" />

          {view === "gallery" ? (
            <GroupHomeworkGallery groupId={groupId} rows={homework} />
          ) : homework.length === 0 ? (
            <Empty>
              This group answers the shared homework. Copy one below to set them
              their own version.
            </Empty>
          ) : (
            <ul className="divide-y rounded-md border">
              {homework.map((row) => (
                <CopyRow
                  key={row.id}
                  title={row.title || row.homeworkId}
                  subtitle={
                    row.lessonTitle
                      ? `Homework for ${row.lessonTitle}`
                      : "Unfiled"
                  }
                  advancedCount={row.advancedCount}
                  baseIsNewer={row.baseIsNewer}
                  badges={<StatusBadge status={row.status} />}
                  edit={
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        to="/studio/group/$groupId/homework/$homeworkId"
                        params={{ groupId, homeworkId: row.homeworkId }}
                      >
                        <PencilIcon />
                        Edit
                      </Link>
                    </Button>
                  }
                  menu={
                    <>
                      <PublishItem
                        status={row.status}
                        busy={busy}
                        onSelect={(next) =>
                          run(() => setGroupHomeworkStatus(row.id, next))
                        }
                      />
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          setRemoving({
                            kind: "homework",
                            id: row.id,
                            title: row.title || row.homeworkId,
                            advancedCount: row.advancedCount,
                          })
                        }
                      >
                        <Trash2Icon />
                        Drop this copy
                      </DropdownMenuItem>
                    </>
                  }
                />
              ))}
            </ul>
          )}

          <Uncopied
            label="Homework attached to this group’s lessons, not copied here:"
            empty="Every homework on this group’s lessons already has a copy."
            items={uncopiedHomework.map((task) => ({
              key: task.id,
              label: task.title || task.id,
            }))}
            busy={busy}
            onAdd={(homeworkId) =>
              run(async () => {
                await addGroupHomework(groupId, [homeworkId]);
              })
            }
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {removing?.kind === "lesson"
                ? `Remove ${removing.title} from ${group.name}?`
                : `Drop ${group.name}’s copy of ${removing?.title}?`}
            </DialogTitle>
            <DialogDescription>
              {removing && removing.advancedCount > 0
                ? `The ${removing.advancedCount} block${
                    removing.advancedCount === 1 ? "" : "s"
                  } added for this group go with it — they exist nowhere else. `
                : ""}
              {removing?.kind === "lesson"
                ? "The shared lesson itself is untouched."
                : "This group goes back to the shared version, which is untouched."}
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
                const target = removing;
                setRemoving(null);
                if (!target) return;
                run(() =>
                  target.kind === "lesson"
                    ? removeGroupLesson(target.id)
                    : target.kind === "material"
                      ? removeGroupMaterial(target.id)
                      : removeGroupHomework(target.id),
                );
              }}
            >
              {removing?.kind === "lesson" ? "Remove" : "Drop the copy"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </Shell>
  );
}

/**
 * The page's frame, drawn by the page rather than by the route: the bar carries
 * the group's name, and the route doesn't know it — this is the only thing that
 * has loaded the group.
 *
 * The name rides in the body face with "Studio" in the display face beside it,
 * which is why the page below has no heading of its own. Before the group lands
 * (and if it never does) the bar falls back to the wordmark rather than to an
 * empty word.
 */
function Shell({
  groupName,
  children,
}: {
  groupName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <SiteNav
        backTo="/groups"
        backLabel="Back to groups"
        title={groupName ? "Studio" : undefined}
        titlePrefix="Group"
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-10">{children}</main>
    </div>
  );
}

function Hint({ tab }: { tab: StudioTab }) {
  const meta = TABS.find((entry) => entry.tab === tab);
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span>{meta.hint}</span>
    </p>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function StatusBadge({ status }: { status: PublishStatus }) {
  return status === "published" ? (
    <Badge variant="secondary">Published</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Draft
    </Badge>
  );
}

function PublishItem({
  status,
  busy,
  onSelect,
}: {
  status: PublishStatus;
  busy: boolean;
  onSelect: (next: PublishStatus) => void;
}) {
  const published = status === "published";
  return (
    <DropdownMenuItem
      disabled={busy}
      onSelect={() => onSelect(published ? "draft" : "published")}
    >
      {published ? <EyeIcon /> : <EyeOffIcon />}
      {published ? "Unpublish" : "Publish"}
    </DropdownMenuItem>
  );
}

/** One copy, however it is stored. Kept generic on purpose: the three kinds
 *  differ in where they link and what their badges say, and in nothing a reader
 *  scanning the list would care about. */
function CopyRow({
  index,
  highlighted = false,
  title,
  subtitle,
  advancedCount,
  baseIsNewer,
  badges,
  before,
  edit,
  menu,
}: {
  /** The running order, for the kind that has one. */
  index?: number;
  highlighted?: boolean;
  title: string;
  subtitle: React.ReactNode;
  advancedCount: number;
  baseIsNewer: boolean;
  badges?: React.ReactNode;
  /** Actions that come before Edit — presenting, for a presentation. */
  before?: React.ReactNode;
  edit: React.ReactNode;
  menu?: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/40",
        highlighted && "bg-primary/[0.04]",
      )}
    >
      {index !== undefined && (
        // The running order, and whether this is the one being taught — one
        // column doing two jobs, because they are the same question asked at
        // two scales.
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
            highlighted
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {index}
        </span>
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          {advancedCount > 0 && (
            <Badge
              variant="secondary"
              className="gap-1 border-primary/30 bg-primary/10 text-primary"
              title="Blocks added for this group"
            >
              {advancedCount} added
            </Badge>
          )}
          {badges}
          {baseIsNewer && (
            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-600 dark:text-amber-400"
              title="The shared version has changed since this copy was made"
            >
              Base updated
            </Badge>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 truncate text-xs text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {before}
        {edit}
        {menu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontalIcon />
                <span className="sr-only">Options for {title}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {menu}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}

/** The things you could copy, as buttons — copying is one press, and a press
 *  that names what it is copying. */
function Uncopied({
  label,
  empty,
  items,
  busy,
  onAdd,
}: {
  label: string;
  empty: string;
  items: { key: string; label: string }[];
  busy: boolean;
  onAdd: (key: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{empty}</p>;
  }

  return (
    <section className="rounded-md border p-4">
      <p className="mb-2 text-xs text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onAdd(item.key)}
            >
              <PlusIcon />
              {item.label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
