import { type ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { DataTableSortableHeader as SortableHeader } from "@/components/data-table-sortable-header";
import { multiSelectFilter } from "@/lib/data-table";
import { ModuleRowActions } from "@/features/modules/components/module-row-actions";
import type { AssignableLesson, ModuleRow } from "@/features/modules/data/modules";

/**
 * A factory rather than a constant (like `studentsColumns`, unlike
 * `classesColumns`) because the row actions need the lesson library and a way to
 * tell the page to reload.
 */
export function modulesColumns({
  lessons,
  onChanged,
}: {
  lessons: AssignableLesson[];
  onChanged: () => void;
}): ColumnDef<ModuleRow>[] {
  return [
    {
      accessorKey: "position",
      header: ({ column }) => <SortableHeader column={column} label="#" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.getValue("position")}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} label="Module" />,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name")}</span>
      ),
    },
    {
      accessorKey: "lessonCount",
      header: ({ column }) => <SortableHeader column={column} label="Lessons" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.getValue("lessonCount")}</span>
      ),
    },
    {
      accessorKey: "studentCount",
      header: ({ column }) => (
        <SortableHeader column={column} label="Students" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">{row.getValue("studentCount")}</span>
      ),
    },
    {
      id: "status",
      // The accessor is the display label: the faceted filter renders whatever
      // the column holds, so a raw boolean would read as "true" in the dropdown.
      accessorFn: (row) => (row.isActive ? "Active" : "Inactive"),
      header: ({ column }) => <SortableHeader column={column} label="Status" />,
      filterFn: multiSelectFilter,
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "secondary"}>
          {row.getValue("status")}
        </Badge>
      ),
    },
    {
      id: "dashboard",
      // Same trick as `status`: the accessor is the label, so the faceted filter
      // and the sort read as words rather than as booleans.
      accessorFn: (row) => (row.showOnDashboard ? "Shown" : "Hidden"),
      header: ({ column }) => (
        <SortableHeader column={column} label="Dashboard" />
      ),
      filterFn: multiSelectFilter,
      cell: ({ row }) => (
        <span
          className={
            row.original.showOnDashboard ? "" : "text-muted-foreground"
          }
        >
          {row.getValue("dashboard")}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <ModuleRowActions
          module={row.original}
          lessons={lessons}
          onChanged={onChanged}
        />
      ),
    },
  ];
}
