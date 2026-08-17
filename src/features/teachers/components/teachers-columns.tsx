import { type ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { DataTableSortableHeader as SortableHeader } from "@/components/data-table-sortable-header";
import { multiSelectFilter } from "@/lib/data-table";
import { TeacherRowActions } from "@/features/teachers/components/teacher-row-actions";
import type { TeacherRow } from "@/features/teachers/data/teachers";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function formatDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

/** A factory, like `studentsColumns`, because the row actions need a way to tell
 *  the page to reload. */
export function teachersColumns({
  onChanged,
}: {
  onChanged: () => void;
}): ColumnDef<TeacherRow>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} label="Name" />,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{row.getValue("name") || "—"}</span>
          {row.original.isAdmin && (
            <Badge variant="secondary" className="font-normal">
              Admin
            </Badge>
          )}
        </span>
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
      accessorKey: "studentCount",
      header: ({ column }) => <SortableHeader column={column} label="Students" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{row.getValue("studentCount")}</span>
      ),
    },
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
      cell: ({ row }) => (
        <TeacherRowActions teacher={row.original} onChanged={onChanged} />
      ),
    },
  ];
}
