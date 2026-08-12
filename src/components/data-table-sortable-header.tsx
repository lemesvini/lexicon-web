import { type Column } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * A column header that toggles sorting on click, showing which direction is
 * active. Drop it into any column def's `header`:
 *
 *     header: ({ column }) => (
 *       <DataTableSortableHeader column={column} label="Title" />
 *     )
 */
export function DataTableSortableHeader<TData>({
  column,
  label,
}: {
  column: Column<TData, unknown>;
  label: string;
}) {
  const sorted = column.getIsSorted();
  const Icon =
    sorted === "asc"
      ? ArrowUpIcon
      : sorted === "desc"
        ? ArrowDownIcon
        : ChevronsUpDownIcon;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-8"
      onClick={() => column.toggleSorting(sorted === "asc")}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <Icon className={sorted ? undefined : "text-muted-foreground"} />
    </Button>
  );
}
