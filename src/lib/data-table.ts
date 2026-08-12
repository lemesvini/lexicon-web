// Filter functions shared by the app's data tables (@/components/data-table).
//
// These live outside the component files so that editing a table's markup keeps
// working with fast refresh — a module that exports both components and plain
// values forces a full reload instead.

import type { Row } from "@tanstack/react-table";

/**
 * Column `filterFn` for a faceted dropdown filter: keeps a row when its value
 * for the column is one of the selected options.
 *
 * The dropdown clears the filter rather than setting an empty selection, but an
 * empty array is treated as "no filter" here too, so a stale value can never
 * blank the table.
 */
export function multiSelectFilter<TData>(
  row: Row<TData>,
  columnId: string,
  filterValue: unknown,
): boolean {
  const selected = filterValue as string[] | undefined;
  if (!selected?.length) return true;
  return selected.includes(row.getValue<string>(columnId));
}
