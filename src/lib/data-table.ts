// Filter functions shared by the app's data tables (@/components/data-table).
//
// These live outside the component files so that editing a table's markup keeps
// working with fast refresh — a module that exports both components and plain
// values forces a full reload instead.

import type * as React from "react";
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

/**
 * Spread onto the wrapper of any cell with its own controls, in a table given an
 * `onRowClick`. Keeps a button, menu or link inside the row from also firing the
 * row's own handler — otherwise "Deactivate" would deactivate *and* navigate.
 *
 * Only the row's own two handlers need stopping: a dropdown's items render in a
 * portal, outside the row, so nothing they do bubbles through it. Keys are
 * covered as well as clicks, for the same reason a keyboard user can reach the
 * button at all.
 */
export const rowClickIgnore = {
  onClick: (event: React.MouseEvent) => event.stopPropagation(),
  onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation(),
} as const;
