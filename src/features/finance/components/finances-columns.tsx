import { type ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { DataTableSortableHeader as SortableHeader } from "@/components/data-table-sortable-header";
import { multiSelectFilter } from "@/lib/data-table";
import { EditFeeDialog } from "@/features/finance/components/edit-fee-dialog";
import { formatMoney, type FinanceRow } from "@/features/finance/data/finance";

/**
 * A factory rather than a constant, for the same two reasons as
 * `studentsColumns`: the row action needs a way to tell the page to reload, and
 * the teacher column is admin-only — on a teacher's own list every row would
 * name them.
 */
export function financesColumns({
  isAdmin,
  onChanged,
}: {
  isAdmin: boolean;
  onChanged: () => void;
}): ColumnDef<FinanceRow>[] {
  return [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} label="Student" />,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("name")}</span>
      ),
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
          } satisfies ColumnDef<FinanceRow>,
        ]
      : []),
    {
      id: "monthlyFee",
      // `undefined` rather than the row's `null`, because `sortUndefined` is
      // what keeps unpriced students at one end of the sort instead of
      // scattered through the middle — and it only recognises undefined.
      accessorFn: (row) => row.monthlyFee ?? undefined,
      header: ({ column }) => <SortableHeader column={column} label="Monthly" />,
      sortUndefined: "last",
      cell: ({ row }) => {
        const fee = row.original.monthlyFee;
        return fee === null ? (
          <span className="text-muted-foreground">Not set</span>
        ) : (
          <span className="tabular-nums">{formatMoney(fee)}</span>
        );
      },
    },
    {
      id: "classesPerWeek",
      accessorFn: (row) => row.classesPerWeek ?? undefined,
      header: ({ column }) => (
        <SortableHeader column={column} label="Classes / week" />
      ),
      sortUndefined: "last",
      cell: ({ row }) => {
        const classes = row.original.classesPerWeek;
        return classes === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">{classes}</span>
        );
      },
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
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <EditFeeDialog student={row.original} onSaved={onChanged} />
        </div>
      ),
    },
  ];
}
