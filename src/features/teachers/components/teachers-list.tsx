import * as React from "react";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { TableSkeleton } from "@/components/table-skeleton";
import { teachersColumns } from "@/features/teachers/components/teachers-columns";
import { AddTeacherDialog } from "@/features/teachers/components/add-teacher-dialog";
import { listTeachers, type TeacherRow } from "@/features/teachers/data/teachers";

/**
 * Everyone who can sign in to the teacher app, with "Add teacher" in the
 * toolbar. Deactivated teachers stay listed behind the status facet, for the
 * same reason inactive students do: nobody should quietly vanish from a list
 * that is meant to be the record of who has access.
 */
export function TeachersList() {
  const [teachers, setTeachers] = React.useState<TeacherRow[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    listTeachers()
      .then((rows) => {
        if (cancelled) return;
        setTeachers(rows);
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
    () => teachersColumns({ onChanged: reload }),
    [reload],
  );

  if (status === "loading") return <TableSkeleton />;

  if (status === "error") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-md border text-center">
        <p className="text-sm text-muted-foreground">Couldn’t load the teachers.</p>
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
      data={teachers}
      filterColumn="name"
      filterPlaceholder="Filter teachers..."
      toolbarActions={<AddTeacherDialog onCreated={reload} />}
      facets={[
        {
          columnId: "status",
          label: "Status",
          options: ["Active", "Inactive"],
          clearLabel: "All statuses",
        },
      ]}
      emptyMessage="No teachers match."
      countLabel={(count) => `${count} teacher${count === 1 ? "" : "s"}`}
    />
  );
}
