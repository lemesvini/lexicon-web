import * as React from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModuleCard } from "@/features/homepage/components/module-card";
import { LessonRowCard } from "@/features/homepage/components/lesson-row-card";
import type { ClassRow } from "@/features/homepage/data/classes";

/** One module and the classes filed under it, in curriculum order. */
type ModuleGroup = {
  name: string;
  rows: ClassRow[];
};

/** Stable default for the two name lists — a fresh `[]` per render would make
 *  the grouping memo recompute on every one of them. */
const NO_MODULES: string[] = [];

function groupByModule(rows: ClassRow[]): ModuleGroup[] {
  const groups = new Map<string, ModuleGroup>();
  for (const row of rows) {
    const key = row.module || "Unfiled";
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else groups.set(key, { name: key, rows: [row] });
  }
  return [...groups.values()];
}

/**
 * The class library as a gallery of modules: click one and its lessons list
 * out in a panel beside the grid, rather than navigating away to see them.
 *
 * The panel sits in the grid's own row instead of over it — a module's cards
 * don't come close to filling the width on anything but a phone, so the space
 * a sidebar would otherwise cover is already going spare.
 */
export function ModulesGallery({
  rows,
  revealedModules = NO_MODULES,
  hiddenModules = NO_MODULES,
  emptyMessage = "No classes match.",
}: {
  rows: ClassRow[];
  /**
   * Modules the Module filter is currently set to. A hidden module shows up
   * only when it is one of these — chosen by name, rather than found by
   * scrolling.
   */
  revealedModules?: string[];
  /**
   * Modules the grid keeps to itself until they are asked for by name — the
   * ones with "Show on dashboard" turned off (0022).
   *
   * Onboarding is the archetype: one class, taught once, to a student who has
   * not started the course yet, so it is a folder a teacher opens a handful of
   * times a year and scrolls past every other day. Which modules those are is
   * the school's business rather than this file's, so it comes from the modules
   * table.
   */
  hiddenModules?: string[];
  emptyMessage?: string;
}) {
  const groups = React.useMemo(() => {
    const revealed = new Set(revealedModules);
    const hidden = new Set(hiddenModules);
    return groupByModule(rows).filter(
      (group) => revealed.has(group.name) || !hidden.has(group.name),
    );
  }, [rows, revealedModules, hiddenModules]);
  const [selected, setSelected] = React.useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  // A module that drops out of the filtered set (search, the module facet)
  // shouldn't leave the panel open on lessons that are no longer shown —
  // computed here rather than synced back with an effect, so there's no
  // render where a stale selection briefly finds a group that's gone.
  const active = groups.find((g) => g.name === selected) ?? null;

  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {groups.map((group, index) => (
          <ModuleCard
            key={group.name}
            name={group.name}
            count={group.rows.length}
            index={index}
            selected={group.name === selected}
            onClick={() =>
              setSelected((prev) => (prev === group.name ? null : group.name))
            }
          />
        ))}
      </div>

      {active && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setSelected(null)}
            aria-hidden="true"
          />
          <aside
            className="fixed right-2 top-2 bottom-2 z-50 w-[min(28rem,calc(100vw-1rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-2xl transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none"
            style={{
              transform: "translateX(0)",
              opacity: 1,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold tracking-tight">
                  {active.name}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {active.rows.length} class
                  {active.rows.length === 1 ? "" : "es"}
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

            <div className="max-h-[calc(100vh-5rem)] space-y-2 overflow-y-auto p-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {active.rows.map((row) => (
                <LessonRowCard key={row.id} row={row} />
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
