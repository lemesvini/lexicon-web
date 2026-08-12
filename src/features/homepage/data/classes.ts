// The row model behind the homepage class table.
//
// A launchable class reaches the table from one of two places: the shared cloud
// library (Supabase `lessons`), or a JSON file the teacher opened this session.
// Both are reduced to the same flat row here so the table has one shape to sort,
// filter and render — see @/features/homepage/components/classes-columns.

import type { CloudLessonSummary } from "@/lib/lessons-cloud";
import type { Lesson } from "@/lib/lessons";

export type ClassSource = "cloud" | "local";

export type ClassRow = {
  id: string;
  title: string;
  unit: string;
  module: string;
  source: ClassSource;
  /** ISO timestamp of the last cloud save; empty for a local file. */
  updatedAt: string;
};

/** Maps a cloud library row, falling back to the slug when a title is missing. */
export function cloudClassRow(row: CloudLessonSummary): ClassRow {
  return {
    id: row.id,
    title: row.title || row.id,
    unit: row.unit,
    module: row.module,
    source: "cloud",
    updatedAt: row.updatedAt,
  };
}

/**
 * Maps a lesson opened from disk. `id` is the routing id minted by the local
 * store (which may differ from the lesson's own slug when it has none), and
 * `fallbackTitle` is used for an untitled file — normally the file name.
 */
export function localClassRow(
  id: string,
  lesson: Lesson,
  fallbackTitle: string,
): ClassRow {
  return {
    id,
    title: lesson.title || fallbackTitle,
    unit: lesson.unit ?? "",
    module: lesson.module ?? "",
    source: "local",
    updatedAt: "",
  };
}
