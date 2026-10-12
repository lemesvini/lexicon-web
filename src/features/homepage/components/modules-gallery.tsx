import * as React from "react";

import { SideSheet } from "@/components/side-sheet";
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
 * out in a side sheet, rather than navigating away to see them.
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

      <SideSheet
        open={active !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={active?.name}
        description={
          active &&
          `${active.rows.length} class${active.rows.length === 1 ? "" : "es"}`
        }
        bodyClassName="space-y-2"
      >
        {active?.rows.map((row) => <LessonRowCard key={row.id} row={row} />)}
      </SideSheet>
    </div>
  );
}
