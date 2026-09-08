import { type ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableSortableHeader as SortableHeader } from "@/components/data-table-sortable-header";
import { multiSelectFilter } from "@/lib/data-table";
import type { SubmissionStatus } from "@/lib/student-content";
import type { SubmissionRow } from "../data/submissions";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatWhen(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  in_progress: "Started",
  submitted: "To correct",
  graded: "Corrected",
};

/** The queue's whole point is spotting "To correct" at a glance, so that one is
 *  the only status with any colour. */
function StatusBadge({ status }: { status: SubmissionStatus }) {
  if (status === "submitted") {
    return <Badge variant="secondary">{STATUS_LABEL.submitted}</Badge>;
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

/**
 * `isAdmin` decides whether the teacher column is here at all: a teacher's queue
 * is only ever their own students (the RLS in 0006 sees to that), so the column
 * would say the same thing on every row.
 */
export function submissionsColumns({
  isAdmin = false,
}: { isAdmin?: boolean } = {}): ColumnDef<SubmissionRow>[] {
  return [
    {
      accessorKey: "studentName",
      header: ({ column }) => <SortableHeader column={column} label="Student" />,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("studentName")}</span>
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
                {row.getValue("teacher")}
              </span>
            ),
          } satisfies ColumnDef<SubmissionRow>,
        ]
      : []),
    {
      accessorKey: "homeworkTitle",
      header: ({ column }) => (
        <SortableHeader column={column} label="Homework" />
      ),
      filterFn: multiSelectFilter,
      // The lesson and module sit under the title rather than in columns of
      // their own: they are here to tell two similarly-named homeworks apart,
      // not to be sorted or filtered on.
      cell: ({ row }) => {
        const context = [row.original.lessonTitle, row.original.module]
          .filter(Boolean)
          .join(" · ");
        return (
          <div className="flex flex-col">
            <span>{row.getValue("homeworkTitle")}</span>
            {context && (
              <span className="text-xs text-muted-foreground">{context}</span>
            )}
          </div>
        );
      },
    },
    {
      // A plain string accessor so the toolbar's faceted filter has label text
      // to group on — it sets an array of the values it sees in the column.
      id: "status",
      accessorFn: (row) => STATUS_LABEL[row.status],
      header: ({ column }) => <SortableHeader column={column} label="Status" />,
      filterFn: multiSelectFilter,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "submittedAt",
      header: ({ column }) => (
        <SortableHeader column={column} label="Handed in" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatWhen(row.getValue("submittedAt"))}
        </span>
      ),
    },
    {
      accessorKey: "score",
      header: ({ column }) => <SortableHeader column={column} label="Mark" />,
      cell: ({ row }) =>
        row.original.score === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="font-medium tabular-nums">
            {row.original.score}
            <span className="text-muted-foreground">/10</span>
          </span>
        ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link
              to="/corrections/$submissionId"
              params={{ submissionId: row.original.id }}
            >
              <PencilIcon />
              {row.original.status === "graded" ? "Review" : "Correct"}
            </Link>
          </Button>
        </div>
      ),
    },
  ];
}
