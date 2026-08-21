import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTableFacetedFilter } from "@/components/data-table-faceted-filter";
import { cn } from "@/lib/utils";

/** A toolbar dropdown that narrows one column to a chosen set of its values. */
export type DataTableFacet = {
  /**
   * Column to filter. Its `filterFn` must be `multiSelectFilter` from
   * @/lib/data-table, which is what reads the selection this dropdown sets.
   */
  columnId: string;
  /** Trigger label while nothing is selected, e.g. "Module". */
  label: string;
  options: string[];
  /** Reset item label, e.g. "All modules". */
  clearLabel?: string;
};

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Column id the search box filters on. Omit to hide the search box. */
  filterColumn?: string;
  filterPlaceholder?: string;
  /** Dropdown filters rendered at the right of the toolbar. */
  facets?: DataTableFacet[];
  /** Caller-owned controls, rendered at the right of the toolbar before the facets. */
  toolbarActions?: React.ReactNode;
  /** Body message when no row survives the active filters. */
  emptyMessage?: string;
  /** Footer row count, e.g. `(n) => \`${n} classes\``. */
  countLabel?: (count: number) => string;
  pageSize?: number;
  /**
   * Makes each row open something — normally a detail page for that row.
   *
   * Rows become focusable and answer Enter as well as a click, so the table is
   * still navigable from the keyboard. A cell holding its own controls (a menu,
   * a link) has to stop the click propagating, or pressing its button would
   * navigate away underneath it — `rowClickIgnore` in @/lib/data-table is the
   * shorthand for that.
   */
  onRowClick?: (row: TData) => void;
};

/**
 * The app's table shell: a toolbar (search box + dropdown filters), sortable
 * headers, and paginated rows. Data-agnostic — callers supply the column defs,
 * so students/groups/finances can reuse it as those pages gain real data.
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumn,
  filterPlaceholder = "Filter...",
  facets = [],
  toolbarActions,
  emptyMessage = "No results.",
  countLabel = (count) => `${count} row${count === 1 ? "" : "s"}`,
  pageSize = 10,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });

  const searchColumn = filterColumn ? table.getColumn(filterColumn) : undefined;
  const filteredCount = table.getFilteredRowModel().rows.length;
  // A caller that filters the rows itself (the homepage, which shares one
  // toolbar between this table and its gallery) hands over neither a search
  // column nor facets, and an empty toolbar is a gap above the table.
  const hasToolbar = Boolean(searchColumn || facets.length || toolbarActions);

  return (
    <div className="w-full space-y-4">
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {searchColumn && (
            <Input
              placeholder={filterPlaceholder}
              value={(searchColumn.getFilterValue() as string) ?? ""}
              onChange={(event) =>
                searchColumn.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
          )}
          <div className="ml-auto flex items-center gap-2">
            {toolbarActions}
            {facets.map((facet) => (
              <DataTableFacetedFilter
                key={facet.columnId}
                column={table.getColumn(facet.columnId)}
                label={facet.label}
                options={facet.options}
                clearLabel={facet.clearLabel}
              />
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  // `button`, not `link`: there is no href to give it, and a
                  // link that isn't one is worse than a button that says so.
                  role={onRowClick ? "button" : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          // Space scrolls the page otherwise, which is a jump
                          // away from the row that was just activated.
                          event.preventDefault();
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                  className={cn(
                    onRowClick &&
                      "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none",
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {countLabel(filteredCount)}
        </div>
        {table.getPageCount() > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRightIcon />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
