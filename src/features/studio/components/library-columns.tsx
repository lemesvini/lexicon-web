import { type ColumnDef } from "@tanstack/react-table";
import { Link } from "@tanstack/react-router";
import { AlertTriangleIcon, PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableSortableHeader as SortableHeader } from "@/components/data-table-sortable-header";
import { multiSelectFilter } from "@/lib/data-table";
import { deleteHomework, setHomeworkStatus } from "../data/homework";
import { deleteMaterial, setMaterialStatus } from "../data/materials";
import type { LibraryAdvancedRow } from "@/features/groups/data/group-lessons";
import type {
  LibraryHomeworkRow,
  LibraryLessonRow,
  LibraryMaterialRow,
} from "../data/library";
import type { PublishStatus } from "../data/publishing";
import { LibraryRowActions } from "./library-row-actions";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function formatUpdated(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormat.format(date);
}

function StatusBadge({ status }: { status: PublishStatus }) {
  return status === "published" ? (
    <Badge variant="secondary">Published</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Draft
    </Badge>
  );
}

function Updated({ iso }: { iso: string }) {
  return (
    <span className="tabular-nums text-muted-foreground">
      {formatUpdated(iso)}
    </span>
  );
}

// ── Presentations ────────────────────────────────────────────────────────────

export function lessonColumns(): ColumnDef<LibraryLessonRow>[] {
  return [
    {
      accessorKey: "title",
      header: ({ column }) => <SortableHeader column={column} label="Title" />,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("title")}</span>
      ),
    },
    {
      accessorKey: "module",
      header: ({ column }) => <SortableHeader column={column} label="Module" />,
      filterFn: multiSelectFilter,
      cell: ({ row }) => row.getValue("module") || "—",
    },
    {
      id: "material",
      header: "Material",
      enableSorting: false,
      // The lesson list is also the answer to "what still has no student copy?",
      // which is otherwise only visible by cross-referencing two tabs — so the
      // cell is also the way to go and write one.
      cell: ({ row }) => {
        const status = row.original.materialStatus;
        return (
          <Link
            to="/studio/material/$lessonId"
            params={{ lessonId: row.original.id }}
            className="inline-flex rounded-sm hover:opacity-80"
          >
            {status ? (
              <StatusBadge status={status} />
            ) : (
              <span className="text-muted-foreground underline decoration-dotted underline-offset-4">
                Write one
              </span>
            )}
          </Link>
        );
      },
    },
    {
      accessorKey: "homeworkCount",
      header: ({ column }) => (
        <SortableHeader column={column} label="Homework" />
      ),
      cell: ({ row }) => {
        const count = row.original.homeworkCount;
        return count === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="tabular-nums">{count}</span>
        );
      },
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <SortableHeader column={column} label="Updated" />,
      cell: ({ row }) => <Updated iso={row.getValue("updatedAt")} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link
              to="/studio/lesson/$lessonId"
              params={{ lessonId: row.original.id }}
            >
              <PencilIcon />
              Edit
            </Link>
          </Button>
        </div>
      ),
    },
  ];
}

// ── Student material ─────────────────────────────────────────────────────────

export function materialColumns({
  onChanged,
}: {
  onChanged: () => void;
}): ColumnDef<LibraryMaterialRow>[] {
  return [
    {
      accessorKey: "title",
      header: ({ column }) => <SortableHeader column={column} label="Lesson" />,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("title")}</span>
      ),
    },
    {
      accessorKey: "module",
      header: ({ column }) => <SortableHeader column={column} label="Module" />,
      filterFn: multiSelectFilter,
      cell: ({ row }) => row.getValue("module") || "—",
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortableHeader column={column} label="Status" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <SortableHeader column={column} label="Updated" />,
      cell: ({ row }) => <Updated iso={row.getValue("updatedAt")} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link
              to="/studio/material/$lessonId"
              params={{ lessonId: row.original.lessonId }}
            >
              <PencilIcon />
              Edit
            </Link>
          </Button>
          <LibraryRowActions
            status={row.original.status}
            onSetStatus={(status) =>
              setMaterialStatus(row.original.lessonId, status)
            }
            onDelete={() => deleteMaterial(row.original.lessonId)}
            deleteTitle={`Delete the material for “${row.original.title}”?`}
            deleteBody="The lesson itself and its presentation are untouched — only the student's copy is deleted. This can't be undone."
            onChanged={onChanged}
          />
        </div>
      ),
    },
  ];
}

// ── Advanced context ─────────────────────────────────────────────────────────
// A group's own copy of a lesson. Read-only from here apart from Edit: a copy is
// created and removed on the group's Lessons tab, where the group it belongs to
// is the thing you are looking at.

export function advancedColumns(): ColumnDef<LibraryAdvancedRow>[] {
  return [
    {
      accessorKey: "groupName",
      header: ({ column }) => <SortableHeader column={column} label="Group" />,
      cell: ({ row }) => (
        <span className="font-medium">{row.getValue("groupName") || "—"}</span>
      ),
    },
    {
      accessorKey: "title",
      header: ({ column }) => <SortableHeader column={column} label="Lesson" />,
      cell: ({ row }) => row.getValue("title") || row.original.lessonId,
    },
    {
      accessorKey: "module",
      header: ({ column }) => <SortableHeader column={column} label="Module" />,
      filterFn: multiSelectFilter,
      cell: ({ row }) => row.getValue("module") || "—",
    },
    {
      accessorKey: "advancedCount",
      header: ({ column }) => <SortableHeader column={column} label="Added" />,
      cell: ({ row }) =>
        row.original.advancedCount > 0 ? (
          <Badge variant="secondary">{row.original.advancedCount}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <SortableHeader column={column} label="Updated" />,
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <Updated iso={row.getValue("updatedAt")} />
          {row.original.baseIsNewer && (
            <span title="The shared lesson has changed since this copy was made">
              <AlertTriangleIcon className="size-3.5 text-amber-600" />
            </span>
          )}
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
              to="/studio/advanced/$groupId/$lessonId"
              params={{
                groupId: row.original.groupId,
                lessonId: row.original.lessonId,
              }}
            >
              <PencilIcon />
              Edit
            </Link>
          </Button>
        </div>
      ),
    },
  ];
}

// ── Homework ─────────────────────────────────────────────────────────────────

export function homeworkColumns({
  onChanged,
}: {
  onChanged: () => void;
}): ColumnDef<LibraryHomeworkRow>[] {
  return [
    {
      accessorKey: "title",
      header: ({ column }) => <SortableHeader column={column} label="Title" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.getValue("title")}</span>
          {row.original.unreachable && (
            <Badge
              variant="outline"
              className="gap-1 border-destructive/40 text-destructive"
              title="Published, but its lesson has no published material — students have no page to see it on."
            >
              <AlertTriangleIcon />
              Unreachable
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "lessonTitle",
      header: ({ column }) => <SortableHeader column={column} label="Lesson" />,
      cell: ({ row }) =>
        row.original.lessonTitle || (
          <span className="text-muted-foreground">Not attached</span>
        ),
    },
    {
      accessorKey: "module",
      header: ({ column }) => <SortableHeader column={column} label="Module" />,
      filterFn: multiSelectFilter,
      cell: ({ row }) => row.getValue("module") || "—",
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortableHeader column={column} label="Status" />,
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => <SortableHeader column={column} label="Updated" />,
      cell: ({ row }) => <Updated iso={row.getValue("updatedAt")} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" asChild>
            <Link
              to="/studio/homework/$homeworkId"
              params={{ homeworkId: row.original.id }}
            >
              <PencilIcon />
              Edit
            </Link>
          </Button>
          <LibraryRowActions
            status={row.original.status}
            onSetStatus={(status) => setHomeworkStatus(row.original.id, status)}
            onDelete={() => deleteHomework(row.original.id)}
            deleteTitle={`Delete “${row.original.title}”?`}
            deleteBody="This can't be undone."
            onChanged={onChanged}
          />
        </div>
      ),
    },
  ];
}
