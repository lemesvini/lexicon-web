import * as React from "react";
import { PlusIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { TableSkeleton } from "@/components/table-skeleton";
import { modulesColumns } from "@/features/modules/components/modules-columns";
import { ModuleDialog } from "@/features/modules/components/module-dialog";
import {
  listModuleOverview,
  type AssignableLesson,
  type ModuleRow,
} from "@/features/modules/data/modules";

/**
 * The curriculum: every module, how much is in it, and who's in it.
 *
 * Each row opens a dialog for picking that module's lessons — which is the whole
 * point of the screen, since a module with no lessons gives its students an
 * empty app.
 */
export function ModulesBoard() {
  const [modules, setModules] = React.useState<ModuleRow[]>([]);
  const [lessons, setLessons] = React.useState<AssignableLesson[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    listModuleOverview()
      .then((overview) => {
        if (cancelled) return;
        setModules(overview.modules);
        setLessons(overview.lessons);
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

  const columns = React.useMemo(
    () => modulesColumns({ lessons, onChanged: reload }),
    [lessons, reload],
  );

  // Lessons the curriculum doesn't account for. The second group is the one
  // worth pointing at: a lesson tagged with a module name that has no row here
  // is unreachable, because a student can only be placed in a real module.
  const { unassigned, unknown } = React.useMemo(() => {
    const known = new Set(modules.map((module) => module.name));
    let unassignedCount = 0;
    const unknownNames = new Set<string>();

    for (const lesson of lessons) {
      const name = lesson.module.trim();
      if (!name) unassignedCount += 1;
      else if (!known.has(name)) unknownNames.add(name);
    }

    return { unassigned: unassignedCount, unknown: [...unknownNames] };
  }, [lessons, modules]);

  if (status === "loading") return <TableSkeleton />;

  if (status === "error") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
        <p className="text-sm text-muted-foreground">
          Couldn’t load the curriculum.
        </p>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCwIcon />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={modules}
        filterColumn="name"
        filterPlaceholder="Filter modules..."
        toolbarActions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon />
            New module
          </Button>
        }
        facets={[
          {
            columnId: "status",
            label: "Status",
            options: ["Active", "Inactive"],
            clearLabel: "All statuses",
          },
        ]}
        emptyMessage="No modules yet."
        countLabel={(count) => `${count} module${count === 1 ? "" : "s"}`}
      />

      {(unassigned > 0 || unknown.length > 0) && (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {unassigned > 0 && (
            <p>
              {unassigned} lesson{unassigned === 1 ? " is" : "s are"} in no
              module. Tick them in any module’s <strong>Lessons</strong> dialog
              to place them.
            </p>
          )}
          {unknown.length > 0 && (
            <p className={unassigned > 0 ? "mt-2" : undefined}>
              Some lessons are tagged with modules that don’t exist here:{" "}
              <span className="text-foreground">{unknown.join(", ")}</span>. No
              student can be given those, so either create the module or move
              the lessons somewhere real.
            </p>
          )}
        </div>
      )}

      <ModuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={reload}
      />
    </div>
  );
}
