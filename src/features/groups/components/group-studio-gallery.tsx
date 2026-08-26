import { Link } from "@tanstack/react-router";
import { AlertTriangleIcon, PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  EditButton,
  Gallery,
  LibraryCard,
  StatusBadge,
} from "@/features/studio/components/library-gallery";
import type { GroupLessonRow } from "@/features/groups/data/group-lessons";
import type {
  GroupHomeworkRow,
  GroupMaterialRow,
} from "@/features/groups/data/group-content";

/**
 * A group's copies as covers, in the Studio library's own gallery.
 *
 * The same tiles, deliberately: a copy is the document the class actually gets,
 * and it should look like the thing it is a copy of rather than like an
 * administrative record of one. What the badges say is the difference — how much
 * of this one is theirs, and whether they can see it yet.
 */

/** How many blocks this group has added, when any. */
function AddedBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge variant="secondary" title="Blocks added for this group">
      {count} added
    </Badge>
  );
}

function OutOfDateBadge({ behind }: { behind: boolean }) {
  if (!behind) return null;
  return (
    <Badge
      variant="outline"
      className="gap-1 border-amber-600/40 text-amber-700 dark:text-amber-400"
      title="The shared version has changed since this copy was made"
    >
      <AlertTriangleIcon />
      Out of date
    </Badge>
  );
}

export function GroupLessonGallery({
  groupId,
  rows,
  currentLessonId,
  /** The planned date, already formatted — the gallery has no opinion on how a
   *  date reads, and the list next to it must agree with whatever that is. */
  plannedDate,
}: {
  groupId: string;
  rows: GroupLessonRow[];
  currentLessonId: string | null;
  plannedDate: (row: GroupLessonRow) => string;
}) {
  return (
    <Gallery
      rows={rows}
      moduleOf={(row) => row.module}
      keyOf={(row) => row.id}
      emptyMessage="No lessons copied yet. Pick a module above and add them."
      renderCard={(row) => (
        <LibraryCard
          title={row.title || row.lessonId}
          meta={[plannedDate(row), row.unit].filter(Boolean).join(" · ")}
          editLink={(children) => (
            <Link
              to="/studio/advanced/$groupId/$lessonId"
              params={{ groupId, lessonId: row.lessonId }}
              aria-label={`Edit this group's copy of ${row.title}`}
              className="focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {children}
            </Link>
          )}
          actions={
            <EditButton>
              <Link
                to="/studio/advanced/$groupId/$lessonId"
                params={{ groupId, lessonId: row.lessonId }}
                aria-label={`Edit this group's copy of ${row.title}`}
              >
                <PencilIcon />
              </Link>
            </EditButton>
          }
          badges={
            <>
              {row.lessonId === currentLessonId && (
                <Badge variant="secondary" title="The lesson this group is on">
                  Current
                </Badge>
              )}
              <AddedBadge count={row.advancedCount} />
              <OutOfDateBadge behind={row.baseIsNewer} />
            </>
          }
        />
      )}
    />
  );
}

export function GroupMaterialGallery({
  groupId,
  rows,
}: {
  groupId: string;
  rows: GroupMaterialRow[];
}) {
  return (
    <Gallery
      rows={rows}
      moduleOf={(row) => row.module}
      keyOf={(row) => row.id}
      emptyMessage="This group reads the shared material."
      renderCard={(row) => (
        <LibraryCard
          title={row.title || row.lessonId}
          meta={row.unit}
          editLink={(children) => (
            <Link
              to="/studio/group/$groupId/material/$lessonId"
              params={{ groupId, lessonId: row.lessonId }}
              aria-label={`Edit this group's material for ${row.title}`}
              className="focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {children}
            </Link>
          )}
          actions={
            <EditButton>
              <Link
                to="/studio/group/$groupId/material/$lessonId"
                params={{ groupId, lessonId: row.lessonId }}
                aria-label={`Edit this group's material for ${row.title}`}
              >
                <PencilIcon />
              </Link>
            </EditButton>
          }
          badges={
            <>
              <StatusBadge status={row.status} />
              <AddedBadge count={row.advancedCount} />
              <OutOfDateBadge behind={row.baseIsNewer} />
            </>
          }
        />
      )}
    />
  );
}

export function GroupHomeworkGallery({
  groupId,
  rows,
}: {
  groupId: string;
  rows: GroupHomeworkRow[];
}) {
  return (
    <Gallery
      rows={rows}
      moduleOf={(row) => row.module}
      keyOf={(row) => row.id}
      emptyMessage="This group answers the shared homework."
      renderCard={(row) => (
        <LibraryCard
          title={row.title || row.homeworkId}
          meta={row.lessonTitle || "Not attached"}
          editLink={(children) => (
            <Link
              to="/studio/group/$groupId/homework/$homeworkId"
              params={{ groupId, homeworkId: row.homeworkId }}
              aria-label={`Edit this group's copy of ${row.title}`}
              className="focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {children}
            </Link>
          )}
          actions={
            <EditButton>
              <Link
                to="/studio/group/$groupId/homework/$homeworkId"
                params={{ groupId, homeworkId: row.homeworkId }}
                aria-label={`Edit this group's copy of ${row.title}`}
              >
                <PencilIcon />
              </Link>
            </EditButton>
          }
          badges={
            <>
              <StatusBadge status={row.status} />
              <AddedBadge count={row.advancedCount} />
              <OutOfDateBadge behind={row.baseIsNewer} />
            </>
          }
        />
      )}
    />
  );
}
