import { type ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { DataTableSortableHeader as SortableHeader } from "@/components/data-table-sortable-header";
import { multiSelectFilter } from "@/lib/data-table";
import {
  FinancesRowActions,
  type FinanceRowHandlers,
} from "@/features/finance/components/finances-row-actions";
import {
  formatMoney,
  PAYMENT_STATUS_LABEL,
  paymentStatus,
  type FinanceRow,
  type PaymentStatus,
} from "@/features/finance/data/finance";
import { methodLabel } from "@/features/finance/data/payments";

const STATUS_VARIANT: Record<
  PaymentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  paid: "default",
  partial: "secondary",
  due: "outline",
  overdue: "destructive",
  unpriced: "outline",
};

/**
 * A factory rather than a constant, for the same two reasons as
 * `studentsColumns`: the row actions need to reach the page's dialogs, and
 * the teacher column is admin-only — on a teacher's own list every row would
 * name them.
 */
export function financesColumns({
  isAdmin,
  handlers,
}: {
  isAdmin: boolean;
  handlers: FinanceRowHandlers;
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
      id: "paymentStatus",
      // Display label as the accessor, for the same reason as `status` below.
      accessorFn: (row) => PAYMENT_STATUS_LABEL[paymentStatus(row)],
      header: ({ column }) => (
        <SortableHeader column={column} label="Payment" />
      ),
      filterFn: multiSelectFilter,
      cell: ({ row }) => {
        const status = paymentStatus(row.original);
        return (
          <Badge variant={STATUS_VARIANT[status]}>
            {PAYMENT_STATUS_LABEL[status]}
          </Badge>
        );
      },
    },
    {
      id: "paidThisMonth",
      accessorFn: (row) => row.paidThisMonth,
      header: ({ column }) => (
        <SortableHeader column={column} label="Paid this month" />
      ),
      cell: ({ row }) =>
        row.original.paidThisMonth > 0 ? (
          <span className="tabular-nums">
            {formatMoney(row.original.paidThisMonth)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "preferredMethod",
      accessorFn: (row) => row.preferredMethod ?? undefined,
      header: () => <span>Usually pays by</span>,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.preferredMethod ? (
          <span className="text-muted-foreground">
            {methodLabel(row.original.preferredMethod)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
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
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <FinancesRowActions student={row.original} handlers={handlers} />
        </div>
      ),
    },
  ];
}
