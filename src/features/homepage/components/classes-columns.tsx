import { type ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { PlayIcon, TabletIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableSortableHeader as SortableHeader } from "@/components/data-table-sortable-header";
import { multiSelectFilter } from "@/lib/data-table";
import type { ClassRow } from "@/features/homepage/data/classes";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

/** Formats a cloud save timestamp, tolerating an empty or unparseable value. */
function formatUpdated(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

export const classesColumns: ColumnDef<ClassRow>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <SortableHeader column={column} label="Title" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{row.getValue("title")}</span>
        {row.original.source === "local" && (
          <Badge variant="outline" className="text-muted-foreground">
            Local file
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: "unit",
    header: ({ column }) => <SortableHeader column={column} label="Unit" />,
    cell: ({ row }) => row.getValue("unit") || "—",
  },
  {
    accessorKey: "module",
    header: ({ column }) => <SortableHeader column={column} label="Module" />,
    // Backs the toolbar's module dropdown, which sets an array of module names.
    filterFn: multiSelectFilter,
    cell: ({ row }) => row.getValue("module") || "—",
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => <SortableHeader column={column} label="Updated" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground tabular-nums">
        {formatUpdated(row.getValue("updatedAt"))}
      </span>
    ),
  },
  {
    id: "launch",
    header: () => <span className="sr-only">Launch</span>,
    enableSorting: false,
    cell: ({ row }) => {
      const lessonId = row.original.id;
      return (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/control/$lessonId" params={{ lessonId }}>
              <TabletIcon />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/present/$lessonId" params={{ lessonId }}>
              <PlayIcon />
            </Link>
          </Button>
        </div>
      );
    },
  },
];
