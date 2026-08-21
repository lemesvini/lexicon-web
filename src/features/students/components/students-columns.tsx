import { type ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { DataTableSortableHeader as SortableHeader } from "@/components/data-table-sortable-header";
import { multiSelectFilter, rowClickIgnore } from "@/lib/data-table";
import { StudentRowActions } from "@/features/students/components/student-row-actions";
import type {
  ModuleOption,
  StudentRow,
  TeacherOption,
} from "@/features/students/data/students";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function formatDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

/**
 * A factory rather than a constant (unlike `classesColumns`) because the row
 * actions need the module list and a way to tell the page to reload.
 *
 * The teacher column is admin-only: on a teacher's own roster every row would
 * name them, which is a column that costs width and says nothing.
 */
export function studentsColumns({
  modules,
  teachers,
  isAdmin,
  onChanged,
}: {
  modules: ModuleOption[];
  teachers: TeacherOption[];
  isAdmin: boolean;
  onChanged: () => void;
}): ColumnDef<StudentRow>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} label="Name" />,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name")}</span>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => <SortableHeader column={column} label="Email" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue("email")}</span>
      ),
    },
    {
      accessorKey: "module",
      header: ({ column }) => <SortableHeader column={column} label="Module" />,
      // Backs the toolbar's module dropdown, which sets an array of names.
      filterFn: multiSelectFilter,
      cell: ({ row }) => {
        const module = row.getValue<string>("module");
        return module === "—" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Badge variant="outline">{module}</Badge>
        );
      },
    },
    ...(isAdmin
      ? [
          {
            accessorKey: "teacher",
            header: ({ column }) => (
              <SortableHeader column={column} label="Teacher" />
            ),
            filterFn: multiSelectFilter,
            cell: ({ row }) => (
              <span className="text-muted-foreground">
                {row.getValue<string>("teacher")}
              </span>
            ),
          } satisfies ColumnDef<StudentRow>,
        ]
      : []),
    {
      id: "status",
      // The accessor is the display label, not the raw value: the faceted filter
      // renders whatever the column holds, and "active" in a dropdown reads as a
      // bug. `row.original.status` is still the raw value where logic needs it.
      accessorFn: (row) => (row.status === "active" ? "Active" : "Inactive"),
      header: ({ column }) => <SortableHeader column={column} label="Status" />,
      filterFn: multiSelectFilter,
      cell: ({ row }) => (
        <Badge
          variant={row.original.status === "active" ? "default" : "secondary"}
        >
          {row.getValue("status")}
        </Badge>
      ),
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => <SortableHeader column={column} label="Added" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {formatDate(row.getValue("createdAt"))}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      // The row itself opens the student, so the menu has to swallow its own
      // clicks — otherwise "Deactivate" would also navigate.
      cell: ({ row }) => (
        <div {...rowClickIgnore}>
          <StudentRowActions
            student={row.original}
            modules={modules}
            teachers={isAdmin ? teachers : []}
            onChanged={onChanged}
          />
        </div>
      ),
    },
  ];
}
