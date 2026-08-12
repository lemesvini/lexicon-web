import { type Column } from "@tanstack/react-table";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DataTableFacetedFilterProps<TData> = {
  column?: Column<TData, unknown>;
  /** Trigger label while nothing is selected, e.g. "Module". */
  label: string;
  /** The values a row's column may be narrowed to. */
  options: string[];
  /** Reset item label, e.g. "All modules". */
  clearLabel?: string;
};

/**
 * The dropdown that narrows one column to a chosen set of its values — a
 * multi-select built from the same checkbox items shadcn's column-visibility
 * menu uses, so it reads as part of the table toolbar.
 *
 * Options are supplied by the caller rather than derived from the rows: the
 * homepage feeds this the full module list from Supabase, which is a superset of
 * the modules the currently-loaded rows happen to cover.
 */
export function DataTableFacetedFilter<TData>({
  column,
  label,
  options,
  clearLabel,
}: DataTableFacetedFilterProps<TData>) {
  const selected = new Set((column?.getFilterValue() as string[]) ?? []);

  const toggle = (option: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(option);
    else next.delete(option);
    // Clearing the filter entirely is not the same as filtering on an empty
    // set — the latter would match no rows at all.
    column?.setFilterValue(next.size ? [...next] : undefined);
  };

  const triggerLabel =
    selected.size === 0
      ? label
      : selected.size === 1
        ? [...selected][0]
        : `${selected.size} selected`;

  return (
    <DropdownMenu>
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
        {options.length === 0 ? (
          <DropdownMenuItem disabled>None available</DropdownMenuItem>
        ) : (
          options.map((option) => (
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
        {selected.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => column?.setFilterValue(undefined)}>
              {clearLabel ?? `All ${label.toLowerCase()}`}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
