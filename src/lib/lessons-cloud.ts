// Cloud persistence for lesson documents.
//
// The Studio saves the full `Lesson` document (see @/lib/lessons) into the
// `lessons` table in Supabase — see supabase/migrations/0001_create_lessons.sql
// for the schema and RLS policies. The row is keyed by the lesson's own slug
// `id`, so saving the same lesson again updates it (upsert) rather than
// creating a duplicate.

import { supabase } from "@/lib/supabase";
import type { Lesson } from "@/lib/lessons";

/** Shape of a row in the `lessons` table (excluding server-managed columns). */
type LessonRow = {
  id: string;
  title: string;
  unit: string;
  module: string;
  document: Lesson;
};

/**
 * Upserts a lesson document to the cloud, keyed by its slug `id`. Throws with a
 * human-readable message on validation or persistence failure.
 *
 * `created_by` is intentionally left off the payload: on insert the column
 * defaults to `auth.uid()`, and on update omitting it keeps the original owner
 * (and satisfies the row-level-security policy, which only lets the owner
 * overwrite their own lesson).
 *
 * So is `order`, for the same mechanism to the opposite end: an upsert only
 * writes the columns it names, so a lesson keeps the place in the curriculum it
 * was given in the database however many times it is edited here.
 */
export async function saveLessonToCloud(lesson: Lesson): Promise<void> {
  const id = lesson.id.trim();
  if (!id) {
    throw new Error(
      "This lesson needs an id before it can be saved to the cloud.",
    );
  }

  const row: LessonRow = {
    id,
    title: lesson.title ?? "",
    unit: lesson.unit ?? "",
    module: lesson.module ?? "",
    document: lesson,
  };

  const { error } = await supabase
    .from("lessons")
    .upsert(row, { onConflict: "id" });

  if (error) throw new Error(error.message);
}

/** A lesson as it appears in the cloud library list — just enough to render a
 *  row and launch present/control, without downloading every document. */
export type CloudLessonSummary = {
  id: string;
  title: string;
  unit: string;
  module: string;
  /**
   * Where the lesson falls in the curriculum: 1 for the first class of the
   * course, counting on across units. `0` means it hasn't been placed yet —
   * the column's default, which every lesson saved from the Studio gets, since
   * nothing in the app writes this column.
   */
  order: number;
  /** The grammar the class covers, as authored in the document. Read out of the
   *  JSON rather than a column: it is the one thing a card shows that isn't
   *  already denormalized, and `->` fetches just the array, not the slides. */
  grammarFocus: string[];
  /** ISO timestamp of the last save. */
  updatedAt: string;
};

/**
 * Curriculum order: `order` ascending, with unplaced lessons last.
 *
 * Last rather than first because `0` is the column default, not a position: a
 * lesson saved from the Studio has no place in the course yet, and putting a
 * fresh draft ahead of lesson one would be reading the default as an answer.
 * Ties keep the order the query returned them in (`sort` is stable).
 */
/**
 * `grammarFocus` as it comes back out of the document, defended. Nothing
 * validates a lesson on the way in (see `parseLesson`), so the field may be
 * missing, null, or an array of something other than strings.
 */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function byCurriculum(a: CloudLessonSummary, b: CloudLessonSummary): number {
  const rank = (order: number) => (order > 0 ? order : Number.MAX_SAFE_INTEGER);
  return rank(a.order) - rank(b.order);
}

/**
 * Lists every lesson in the shared cloud library (RLS lets any signed-in
 * teacher read all rows), in curriculum order. Only the denormalized summary
 * columns are fetched — the full `document` is loaded on demand when a class is
 * actually launched (see {@link fetchCloudLesson}).
 *
 * The unplaced-last rule is applied here rather than in the query because it
 * can't be: `order by "order"` puts every 0 first, and PostgREST has nowhere to
 * put the expression that wouldn't. The library is a couple of dozen rows, so
 * re-sorting the materialized list costs nothing — and every caller (the
 * homepage, the Studio, the group and homework pickers) gets the curriculum's
 * own sequence for free.
 */
export async function listCloudLessons(): Promise<CloudLessonSummary[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("id, title, unit, module, order, updated_at, grammarFocus:document->grammarFocus")
    // Newest-save-first among the unplaced, which the stable sort below keeps.
    .order("order", { ascending: true })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      title: row.title ?? "",
      unit: row.unit ?? "",
      module: row.module ?? "",
      order: row.order ?? 0,
      grammarFocus: stringList(row.grammarFocus),
      updatedAt: row.updated_at ?? "",
    }))
    .sort(byCurriculum);
}

/**
 * Lists every distinct module name in the cloud library, alphabetically. Feeds
 * the homepage's module filter, so a teacher can narrow the class list to one
 * module (or several) without the app hard-coding the curriculum.
 *
 * Modules exist only as a denormalized column on `lessons` — there is no modules
 * table — and PostgREST exposes no DISTINCT, so the column is fetched and deduped
 * here. Ordering server-side means the Set below comes out already sorted.
 */
export async function listCloudModules(): Promise<string[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("module")
    .order("module", { ascending: true });

  if (error) throw new Error(error.message);

  const modules = new Set<string>();
  for (const row of data ?? []) {
    const name = (row.module ?? "").trim();
    if (name) modules.add(name);
  }
  return [...modules];
}

/**
 * Fetches the full lesson document for a cloud lesson id, or undefined if no
 * such row exists. Used by present/control to run a class that isn't bundled
 * into the app at build time.
 */
export async function fetchCloudLesson(id: string): Promise<Lesson | undefined> {
  const { data, error } = await supabase
    .from("lessons")
    .select("document")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.document as Lesson | undefined) ?? undefined;
}
