import * as React from "react";
import { FolderIcon, ListIcon, PlusIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/data-table";
import { TableSkeleton } from "@/components/table-skeleton";
import { modulesColumns } from "@/features/modules/components/modules-columns";
import { ModuleDialog } from "@/features/modules/components/module-dialog";
import { ModulesCards } from "@/features/modules/components/modules-cards";
import {
  listModuleOverview,
  type AssignableLesson,
  type ModuleRow,
} from "@/features/modules/data/modules";

/**
 * Where the chosen view is remembered, in the shape the homepage uses for the
 * same preference (@/features/homepage/components/presenter-menu): how you like
 * to read the curriculum is not a per-visit question.
 */
const VIEW_KEY = "modules:view";

type ModulesView = "cards" | "table";

function readViewPreference(): ModulesView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "table"
      ? "table"
      : "cards";
  } catch {
    // Private mode, blocked storage — a preference is not a reason to fail to
    // draw the page.
    return "cards";
  }
}

const VIEWS: { value: ModulesView; label: string; icon: typeof FolderIcon }[] = [
  { value: "cards", label: "Modules", icon: FolderIcon },
  { value: "table", label: "List", icon: ListIcon },
];

/**
 * The curriculum: every module, how much is in it, and who's in it.
 *
 * Two views over the same rows, the dashboard's folder grid and the table —
 * cards first, because picking a module out of a wall of tiles is what a teacher
 * already does on the front page, and the table is where the answer is a number
 * (how many students, what position, which are off the dashboard).
 *
 * Either way a module opens a dialog for picking its lessons — which is the
 * whole point of the screen, since a module with no lessons gives its students
 * an empty app.
 */
export function ModulesBoard() {
  const [modules, setModules] = React.useState<ModuleRow[]>([]);
  const [lessons, setLessons] = React.useState<AssignableLesson[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [view, setView] = React.useState<ModulesView>(readViewPreference);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      // See readViewPreference — the toggle still works for this session.
    }
  }, [view]);

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

  const viewToggle = (
    <div
      role="group"
      aria-label="View"
      className="flex items-center gap-0.5 rounded-md bg-muted p-0.5"
    >
      {VIEWS.map((option) => (
        <Button
          key={option.value}
          variant="ghost"
          size="icon-sm"
          aria-pressed={view === option.value}
          title={option.label}
          onClick={() => setView(option.value)}
          className={cn(
            "text-muted-foreground hover:bg-background/60",
            view === option.value &&
              "bg-background text-foreground shadow-xs hover:bg-background",
          )}
        >
          <option.icon />
          <span className="sr-only">{option.label}</span>
        </Button>
      ))}
    </div>
  );

  const newModuleButton = (
    <Button size="sm" onClick={() => setCreateOpen(true)}>
      <PlusIcon />
      New module
    </Button>
  );

  return (
    <div className="space-y-4">
      {view === "cards" ? (
        <>
          <div className="flex items-center justify-end gap-2">
            {viewToggle}
            {newModuleButton}
          </div>
          <ModulesCards
            modules={modules}
            lessons={lessons}
            onChanged={reload}
          />
        </>
      ) : (
        <DataTable
          columns={columns}
          data={modules}
          filterColumn="name"
          filterPlaceholder="Filter modules..."
          toolbarActions={
            <>
              {viewToggle}
              {newModuleButton}
            </>
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
      )}

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
