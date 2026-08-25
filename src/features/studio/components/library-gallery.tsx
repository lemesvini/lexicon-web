import * as React from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangleIcon, PencilIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BLOCK_REGISTRY } from "@/features/blocks";
import {
  splitTitle,
  wrapHeadline,
} from "@/features/homepage/components/class-card";
import type { LibraryAdvancedRow } from "@/features/groups/data/group-lessons";
import { deleteHomework, setHomeworkStatus } from "../data/homework";
import { deleteMaterial, setMaterialStatus } from "../data/materials";
import type {
  LibraryHomeworkRow,
  LibraryLessonRow,
  LibraryMaterialRow,
} from "../data/library";
import type { PublishStatus } from "../data/publishing";
import { LibraryRowActions } from "./library-row-actions";

/**
 * The same title block the presenter projects, drawn at card size — see
 * {@link ClassCard}, which is where this cover comes from. A lookalike here
 * would be a second cover to keep in step with the first.
 */
const TitleCover = BLOCK_REGISTRY.title.View;

function groupByModule<T>(
  rows: T[],
  moduleOf: (row: T) => string,
): { name: string; rows: T[] }[] {
  const groups = new Map<string, { name: string; rows: T[] }>();
  for (const row of rows) {
    const name = moduleOf(row).trim() || "Unfiled";
    const group = groups.get(name);
    if (group) group.rows.push(row);
    else groups.set(name, { name, rows: [row] });
  }
  return [...groups.values()];
}

/**
 * The library as covers rather than rows: one section per module, every one of
 * them open.
 *
 * The homepage's gallery collapses to the first unit because a teacher opens it
 * to start the class they are teaching now. This one is where authoring starts —
 * the question is "which of these am I writing", and hiding all but the first
 * module behind a button would put most of the answer out of sight.
 *
 * The rows arrive in curriculum order (see `listStudioLibrary`), so a module's
 * first appearance is its place in the course and each section is already
 * sequenced.
 */
function Gallery<T>({
  rows,
  moduleOf,
  keyOf,
  renderCard,
  emptyMessage,
}: {
  rows: T[];
  moduleOf: (row: T) => string;
  keyOf: (row: T) => string;
  renderCard: (row: T) => React.ReactNode;
  emptyMessage: string;
}) {
  const groups = React.useMemo(
    () => groupByModule(rows, moduleOf),
    [rows, moduleOf],
  );

  if (groups.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.name} className="space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              {group.name}
            </h2>
            <span className="text-xs tabular-nums text-muted-foreground">
              {group.rows.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {group.rows.map((row) => (
              <React.Fragment key={keyOf(row)}>{renderCard(row)}</React.Fragment>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * One artifact as a tile: its cover, what it is, and whatever the kind says
 * about it.
 *
 * The cover doubles as the link into the editor. Everything in this library is
 * here to be written, so the biggest thing on the card is the thing you came to
 * press — the same bargain the homepage's card makes with Present.
 */
function LibraryCard({
  title,
  meta,
  editLink,
  badges,
  actions,
}: {
  title: string;
  /** The line under the name — normally unit, or the lesson it belongs to. */
  meta: string;
  /** Wraps the cover and the name in the kind's own typed `Link`. */
  editLink: (children: React.ReactNode) => React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const { label, name } = splitTitle(title);

  return (
    <article className="flex flex-col gap-2.5">
      {editLink(
        <span className="block overflow-hidden rounded-xl shadow-sm transition-shadow hover:shadow-md">
          <TitleCover
            audience="student"
            block={{
              type: "title",
              eyebrow: label || undefined,
              title: wrapHeadline(name),
              color: "jade",
            }}
          />
        </span>,
      )}

      <div className="space-y-1.5">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-medium tracking-tight">
              {label || name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              {meta || "—"}
            </p>
          </div>
          {actions && (
            <div className="flex shrink-0 items-center">{actions}</div>
          )}
        </div>

        {badges && (
          <div className="flex flex-wrap items-center gap-1.5">{badges}</div>
        )}
      </div>
    </article>
  );
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

function EditButton({ children }: { children: React.ReactNode }) {
  return (
    <Button variant="ghost" size="icon-sm" className="text-primary" asChild>
      {children}
    </Button>
  );
}

// ── Presentations ────────────────────────────────────────────────────────────

export function LessonGallery({ rows }: { rows: LibraryLessonRow[] }) {
  return (
    <Gallery
      rows={rows}
      moduleOf={(row) => row.module}
      keyOf={(row) => row.id}
      emptyMessage="Nothing here yet — Create makes the first one."
      renderCard={(row) => (
        <LibraryCard
          title={row.title}
          meta={row.unit}
          editLink={(children) => (
            <Link
              to="/studio/lesson/$lessonId"
              params={{ lessonId: row.id }}
              aria-label={`Edit ${row.title}`}
              className="focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {children}
            </Link>
          )}
          actions={
            <EditButton>
              <Link
                to="/studio/lesson/$lessonId"
                params={{ lessonId: row.id }}
                aria-label={`Edit ${row.title}`}
              >
                <PencilIcon />
              </Link>
            </EditButton>
          }
          badges={
            <>
              {/* The lesson tab is also the answer to "what still has no
                  student copy?", which is otherwise only visible by
                  cross-referencing two tabs — so the badge is also the way to
                  go and write one. */}
              <Link
                to="/studio/material/$lessonId"
                params={{ lessonId: row.id }}
                className="inline-flex rounded-sm hover:opacity-80"
              >
                {row.materialStatus ? (
                  <StatusBadge status={row.materialStatus} />
                ) : (
                  <span className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4">
                    Write material
                  </span>
                )}
              </Link>
              {row.homeworkCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-muted-foreground"
                  title="Homework attached to this lesson"
                >
                  {row.homeworkCount} homework
                </Badge>
              )}
            </>
          }
        />
      )}
    />
  );
}

// ── Student material ─────────────────────────────────────────────────────────

export function MaterialGallery({
  rows,
  onChanged,
}: {
  rows: LibraryMaterialRow[];
  onChanged: () => void;
}) {
  return (
    <Gallery
      rows={rows}
      moduleOf={(row) => row.module}
      keyOf={(row) => row.lessonId}
      emptyMessage="No student material yet."
      renderCard={(row) => (
        <LibraryCard
          title={row.title}
          meta={row.unit}
          editLink={(children) => (
            <Link
              to="/studio/material/$lessonId"
              params={{ lessonId: row.lessonId }}
              aria-label={`Edit the material for ${row.title}`}
              className="focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {children}
            </Link>
          )}
          actions={
            <>
              <EditButton>
                <Link
                  to="/studio/material/$lessonId"
                  params={{ lessonId: row.lessonId }}
                  aria-label={`Edit the material for ${row.title}`}
                >
                  <PencilIcon />
                </Link>
              </EditButton>
              <LibraryRowActions
                status={row.status}
                onSetStatus={(status) => setMaterialStatus(row.lessonId, status)}
                onDelete={() => deleteMaterial(row.lessonId)}
                deleteTitle={`Delete the material for “${row.title}”?`}
                deleteBody="The lesson itself and its presentation are untouched — only the student's copy is deleted. This can't be undone."
                onChanged={onChanged}
              />
            </>
          }
          badges={<StatusBadge status={row.status} />}
        />
      )}
    />
  );
}

// ── Advanced context ─────────────────────────────────────────────────────────

export function AdvancedGallery({ rows }: { rows: LibraryAdvancedRow[] }) {
  return (
    <Gallery
      rows={rows}
      moduleOf={(row) => row.module}
      keyOf={(row) => row.id}
      emptyMessage="No group has its own copy of a lesson yet. Assign a module on a group's Lessons tab."
      renderCard={(row) => (
        <LibraryCard
          title={row.title || row.lessonId}
          meta={row.groupName || "—"}
          editLink={(children) => (
            <Link
              to="/studio/advanced/$groupId/$lessonId"
              params={{ groupId: row.groupId, lessonId: row.lessonId }}
              aria-label={`Edit ${row.groupName}'s copy of ${row.title}`}
              className="focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {children}
            </Link>
          )}
          actions={
            <EditButton>
              <Link
                to="/studio/advanced/$groupId/$lessonId"
                params={{ groupId: row.groupId, lessonId: row.lessonId }}
                aria-label={`Edit ${row.groupName}'s copy of ${row.title}`}
              >
                <PencilIcon />
              </Link>
            </EditButton>
          }
          badges={
            <>
              {row.advancedCount > 0 && (
                <Badge variant="secondary" title="Blocks this group has added">
                  {row.advancedCount} added
                </Badge>
              )}
              {row.baseIsNewer && (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-600/40 text-amber-700"
                  title="The shared lesson has changed since this copy was made"
                >
                  <AlertTriangleIcon />
                  Out of date
                </Badge>
              )}
            </>
          }
        />
      )}
    />
  );
}

// ── Homework ─────────────────────────────────────────────────────────────────

export function HomeworkGallery({
  rows,
  onChanged,
}: {
  rows: LibraryHomeworkRow[];
  onChanged: () => void;
}) {
  return (
    <Gallery
      rows={rows}
      moduleOf={(row) => row.module}
      keyOf={(row) => row.id}
      emptyMessage="No homework yet."
      renderCard={(row) => (
        <LibraryCard
          title={row.title}
          meta={row.lessonTitle || "Not attached"}
          editLink={(children) => (
            <Link
              to="/studio/homework/$homeworkId"
              params={{ homeworkId: row.id }}
              aria-label={`Edit ${row.title}`}
              className="focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {children}
            </Link>
          )}
          actions={
            <>
              <EditButton>
                <Link
                  to="/studio/homework/$homeworkId"
                  params={{ homeworkId: row.id }}
                  aria-label={`Edit ${row.title}`}
                >
                  <PencilIcon />
                </Link>
              </EditButton>
              <LibraryRowActions
                status={row.status}
                onSetStatus={(status) => setHomeworkStatus(row.id, status)}
                onDelete={() => deleteHomework(row.id)}
                deleteTitle={`Delete “${row.title}”?`}
                deleteBody="This can't be undone."
                onChanged={onChanged}
              />
            </>
          }
          badges={
            <>
              <StatusBadge status={row.status} />
              {row.unreachable && (
                <Badge
                  variant="outline"
                  className="gap-1 border-destructive/40 text-destructive"
                  title="Published, but its lesson has no published material — students have no page to see it on."
                >
                  <AlertTriangleIcon />
                  Unreachable
                </Badge>
              )}
            </>
          }
        />
      )}
    />
  );
}
