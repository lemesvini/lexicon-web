import * as React from "react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { TableSkeleton } from "@/components/table-skeleton";
import { studentsColumns } from "@/features/students/components/students-columns";
import { AddStudentDialog } from "@/features/students/components/add-student-dialog";
import {
  listModules,
  listStudents,
  NO_MODULE,
  type ModuleOption,
  type StudentRow,
} from "@/features/students/data/students";

/**
 * The roster: every student, active and inactive, in one searchable table with
 * "Add student" in the toolbar.
 *
 * Inactive students are listed rather than hidden — the status facet is there to
 * narrow the view on demand, so nobody quietly disappears from the roster after
 * being deactivated.
 */
export function StudentsRoster() {
  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [modules, setModules] = React.useState<ModuleOption[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    // The module list is its own query rather than being derived from the rows:
    // a module with no student in it still has to be pickable.
    Promise.all([listStudents(), listModules()])
      .then(([rows, moduleOptions]) => {
        if (cancelled) return;
        setStudents(rows);
        setModules(moduleOptions);
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
    () => studentsColumns({ modules, onChanged: reload }),
    [modules, reload],
  );

  // Facet options come from the module list plus the placeholder, so "no module
  // yet" is something you can filter down to.
  const moduleOptions = React.useMemo(
    () => [...modules.map((module) => module.name), NO_MODULE],
    [modules],
  );

  if (status === "loading") return <TableSkeleton />;

  if (status === "error") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
        <p className="text-sm text-muted-foreground">
          Couldn’t load the student roster.
        </p>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCwIcon />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={students}
      filterColumn="name"
      filterPlaceholder="Filter students..."
      toolbarActions={
        <AddStudentDialog modules={modules} onCreated={reload} />
      }
      facets={[
        {
          columnId: "module",
          label: "Module",
          options: moduleOptions,
          clearLabel: "All modules",
        },
        {
          columnId: "status",
          label: "Status",
          options: ["Active", "Inactive"],
          clearLabel: "All statuses",
        },
      ]}
      emptyMessage="No students match."
      countLabel={(count) => `${count} student${count === 1 ? "" : "s"}`}
    />
  );
}
