import * as React from "react";
import { type Column } from "@tanstack/react-table";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FacetedFilterProps = {
  /** Trigger label while nothing is selected, e.g. "Module". */
  label: string;
  /** The values a row's column may be narrowed to. */
  options: string[];
  /** Reset item label, e.g. "All modules". */
  clearLabel?: string;
  /** The currently chosen values. Empty means "everything". */
  value: string[];
  onValueChange: (next: string[]) => void;
  /**
   * How many options the menu lists before it stops and asks you to search.
   * A dropdown is a list you scan, not one you scroll: past a dozen entries
   * typing two letters is faster than reading, and a menu long enough to run
   * off the screen hides its own clear button.
   */
  maxVisible?: number;
  /** Search box placeholder, e.g. "Search modules...". */
  searchPlaceholder?: string;
};

type DataTableFacetedFilterProps<TData> = Omit<
  FacetedFilterProps,
  "value" | "onValueChange"
> & {
  column?: Column<TData, unknown>;
};

/**
 * The same dropdown, bound to a table column instead of to state — what
 * `DataTable`'s own toolbar renders.
 */
export function DataTableFacetedFilter<TData>({
  column,
  ...props
}: DataTableFacetedFilterProps<TData>) {
  return (
    <FacetedFilter
      {...props}
      value={(column?.getFilterValue() as string[]) ?? []}
      // Clearing the filter entirely is not the same as filtering on an empty
      // set — the latter would match no rows at all.
      onValueChange={(next) => column?.setFilterValue(next.length ? next : undefined)}
    />
  );
}

/**
 * The dropdown that narrows a list to a chosen set of values — a multi-select
 * built from the same checkbox items shadcn's column-visibility menu uses, so it
 * reads as part of the table toolbar.
 *
 * Presentational, so it can serve a toolbar that isn't a table's: the homepage
 * filters the same rows through a table and through a gallery, and only one of
 * those has columns to hang a filter off.
 *
 * Options are supplied by the caller rather than derived from the rows: the
 * homepage feeds this the full module list from Supabase, which is a superset of
 * the modules the currently-loaded rows happen to cover.
 */
export function FacetedFilter({
  label,
  options,
  clearLabel,
  value,
  onValueChange,
  maxVisible = 10,
  searchPlaceholder,
}: FacetedFilterProps) {
  const [query, setQuery] = React.useState("");
  const selected = new Set(value);

  // Short lists are the whole list, no box — a search field above two options
  // is furniture.
  const searchable = options.length > maxVisible;
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? options.filter((option) => option.toLowerCase().includes(needle))
    : options;
  // The selected ones come first, so ticking something never makes it jump out
  // of view, then as many of the rest as fit.
  const visible = [
    ...matches.filter((option) => selected.has(option)),
    ...matches.filter((option) => !selected.has(option)),
  ].slice(0, maxVisible);
  const hidden = matches.length - visible.length;

  const toggle = (option: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(option);
    else next.delete(option);
    onValueChange([...next]);
  };

  const triggerLabel =
    selected.size === 0
      ? label
      : selected.size === 1
        ? [...selected][0]
        : `${selected.size} selected`;

  return (
    <DropdownMenu onOpenChange={(open) => !open && setQuery("")}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="bg-muted" size="sm">
          <span className="max-w-40 truncate text-muted-foreground">
            {triggerLabel}
          </span>
          <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {searchable && (
          <div className="p-1">
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}...`}
              className="h-8"
              // Radix menus type-ahead to move the highlight; without this every
              // keystroke would be swallowed before it reached the box.
              onKeyDown={(event) => event.stopPropagation()}
            />
          </div>
        )}
        {options.length === 0 ? (
          <DropdownMenuItem disabled>None available</DropdownMenuItem>
        ) : visible.length === 0 ? (
          <DropdownMenuItem disabled>No matches</DropdownMenuItem>
        ) : (
          visible.map((option) => (
            <DropdownMenuCheckboxItem
              key={option}
              checked={selected.has(option)}
              // Keep the menu open so several modules can be picked in one go.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => toggle(option, !!checked)}
            >
              <span className="truncate">{option}</span>
            </DropdownMenuCheckboxItem>
          ))
        )}
        {hidden > 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {hidden} more — keep typing to narrow it down.
          </p>
        )}
        {selected.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onValueChange([])}>
              {clearLabel ?? `All ${label.toLowerCase()}`}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
