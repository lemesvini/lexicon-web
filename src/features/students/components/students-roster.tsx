import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { TableSkeleton } from "@/components/table-skeleton";
import { useAuth } from "@/hooks/use-auth";
import { studentsColumns } from "@/features/students/components/students-columns";
import { AddStudentDialog } from "@/features/students/components/add-student-dialog";
import {
  listModules,
  listStudents,
  listTeacherOptions,
  NO_MODULE,
  type ModuleOption,
  type StudentRow,
  type TeacherOption,
} from "@/features/students/data/students";

/**
 * The roster: every student the signed-in user is allowed to see, active and
 * inactive, in one searchable table with "Add student" in the toolbar.
 *
 * Which students those are is decided in the database, not here — a teacher gets
 * their own, the admin gets everyone (see 0006). The one thing the role changes
 * on this side is the teacher column and picker, which say nothing useful on a
 * roster where every row has the same answer.
 *
 * Inactive students are listed rather than hidden — the status facet is there to
 * narrow the view on demand, so nobody quietly disappears from the roster after
 * being deactivated.
 *
 * A row opens that student's dashboard. The roster answers "who is here?"; the
 * questions after it ("how are they doing?", "what have they handed in?") all
 * belong to one student, and there is no room for any of them in a column.
 */
export function StudentsRoster() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const navigate = useNavigate();

  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [modules, setModules] = React.useState<ModuleOption[]>([]);
  const [teachers, setTeachers] = React.useState<TeacherOption[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    // The module list is its own query rather than being derived from the rows:
    // a module with no student in it still has to be pickable. Same for the
    // teachers — a teacher with no students yet is exactly who you're adding a
    // student for.
    Promise.all([listStudents(), listModules(), listTeacherOptions()])
      .then(([rows, moduleOptions, teacherOptions]) => {
        if (cancelled) return;
        setStudents(rows);
        setModules(moduleOptions);
        setTeachers(teacherOptions);
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
    () => studentsColumns({ modules, teachers, isAdmin, onChanged: reload }),
    [modules, teachers, isAdmin, reload],
  );

  // Facet options come from the module list plus the placeholder, so "no module
  // yet" is something you can filter down to.
  const moduleOptions = React.useMemo(
    () => [...modules.map((module) => module.name), NO_MODULE],
    [modules],
  );

  // The teacher facet is built from the rows rather than from `teachers`: a
  // deactivated teacher isn't in the picker but their students are still here,
  // and a facet that can't select them would leave those rows unreachable.
  const teacherOptions = React.useMemo(
    () => [...new Set(students.map((student) => student.teacher))].sort(),
    [students],
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
        <AddStudentDialog
          modules={modules}
          teachers={teachers}
          currentTeacherId={profile?.id ?? ""}
          onCreated={reload}
        />
      }
      facets={[
        {
          columnId: "module",
          label: "Module",
          options: moduleOptions,
          clearLabel: "All modules",
        },
        ...(isAdmin
          ? [
              {
                columnId: "teacher",
                label: "Teacher",
                options: teacherOptions,
                clearLabel: "All teachers",
              },
            ]
          : []),
        {
          columnId: "status",
          label: "Status",
          options: ["Active", "Inactive"],
          clearLabel: "All statuses",
        },
      ]}
      emptyMessage="No students match."
      countLabel={(count) => `${count} student${count === 1 ? "" : "s"}`}
      onRowClick={(student) =>
        void navigate({
          to: "/students/$studentId",
          params: { studentId: student.id },
        })
      }
    />
  );
}
