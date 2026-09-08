import * as React from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModuleCard } from "@/features/homepage/components/module-card";
import { LessonRowCard } from "@/features/homepage/components/lesson-row-card";
import { cloudClassRow } from "@/features/homepage/data/classes";
import { ModuleRowActions } from "@/features/modules/components/module-row-actions";
import type {
  AssignableLesson,
  ModuleRow,
} from "@/features/modules/data/modules";

/**
 * The curriculum as the homepage draws it: one folder per module, and clicking
 * one opens its lessons in a panel beside the grid.
 *
 * The same `ModuleCard` and `LessonRowCard` as the dashboard on purpose — this
 * screen and the front page are two views of one curriculum, and a teacher who
 * has learnt to find a module by its tile should find it in the same shape here.
 *
 * What it does not share is where the folders come from: the dashboard groups
 * the lessons it has, so a module nobody has filed anything under isn't there.
 * Here every module has a card, empty ones included — a module with no lessons
 * is precisely what this screen exists to fix, and it can't be fixed from a grid
 * that hides it.
 */
export function ModulesCards({
  modules,
  lessons,
  onChanged,
}: {
  modules: ModuleRow[];
  /** Every lesson in the library — the panel picks out its module's own. */
  lessons: AssignableLesson[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = React.useState<string | null>(null);

  // Keyed by the module name, which is what a lesson stores — there is no
  // foreign key between the two (see the note atop features/modules/data).
  const lessonsByModule = React.useMemo(() => {
    const byModule = new Map<string, AssignableLesson[]>();
    for (const lesson of lessons) {
      const name = lesson.module.trim();
      const existing = byModule.get(name);
      if (existing) existing.push(lesson);
      else byModule.set(name, [lesson]);
    }
    return byModule;
  }, [lessons]);

  if (modules.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border text-sm text-muted-foreground">
        No modules yet.
      </div>
    );
  }

  // Resolved from the current list rather than held in state, so a module that
  // is renamed or deleted underneath the panel closes it instead of leaving it
  // open on something that no longer exists.
  const active = modules.find((module) => module.id === selected) ?? null;
  const activeLessons = active
    ? (lessonsByModule.get(active.name.trim()) ?? [])
    : [];

  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {modules.map((module, index) => (
          <div key={module.id} className="space-y-1.5">
            <ModuleCard
              name={module.name}
              count={module.lessonCount}
              index={index}
              selected={module.id === selected}
              onClick={() =>
                setSelected((prev) => (prev === module.id ? null : module.id))
              }
            />
            {/* Under the tile rather than on it: the card is the dashboard's,
                and these two are states only this screen can act on. */}
            {(!module.isActive || !module.showOnDashboard) && (
              <div className="flex flex-wrap gap-1">
                {!module.isActive && <Badge variant="secondary">Inactive</Badge>}
                {!module.showOnDashboard && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Off dashboard
                  </Badge>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {active && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setSelected(null)}
            aria-hidden="true"
          />
          <aside className="fixed right-2 top-2 bottom-2 z-50 flex w-[min(28rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-tight">
                  {active.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {active.lessonCount} lesson
                  {active.lessonCount === 1 ? "" : "s"} · {active.studentCount}{" "}
                  student{active.studentCount === 1 ? "" : "s"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                <XIcon />
              </Button>
            </div>

            {/* The row's own actions, minus the lesson picker: the panel below
                is already this module's lesson list, and the picker would open a
                second one on top of it. Filing lessons is done from the list
                view, where there is no such list to duplicate. */}
            <div className="border-b px-2 py-2">
              <ModuleRowActions
                module={active}
                lessons={lessons}
                onChanged={onChanged}
                showLessons={false}
              />
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {activeLessons.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Nothing in this module yet. Switch to the list view and open
                  this module’s <strong>Lessons</strong> to put classes in it.
                </p>
              ) : (
                activeLessons.map((lesson) => (
                  <LessonRowCard key={lesson.id} row={cloudClassRow(lesson)} />
                ))
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
