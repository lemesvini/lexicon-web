// A group's own copies of the lessons in its module.
//
// Schema and RLS in supabase/migrations/0010_advanced_context.sql. One row is one
// lesson as one class will actually see it: the whole document, the date it is
// expected to happen, and where it sits in that group's running order.
//
// The copy is a snapshot, not a live view of `lessons`. That is the trade the
// feature is built on — a teacher may add blocks to their copy without touching
// what every other class gets, and in exchange a copy can fall behind the lesson
// it came from. `base_synced_at` is how the app notices (`baseIsNewer`), and
// `rebaseOnto` in @/features/studio/advanced-context is how it offers to catch
// up without losing the additions.
//
// Adding is always additive. `addGroupLessons` ignores conflicts rather than
// overwriting, so "add this module's lessons" is safe to press twice, safe to
// press again after the module gained a lesson, and safe to press for a second
// module without disturbing the first.

import type { Lesson } from "@/lib/lessons";
import { supabase } from "@/lib/supabase";
import { advancedCount } from "@/features/studio/advanced-context";
import { fetchCloudLesson, type CloudLessonSummary } from "@/lib/lessons-cloud";

import { fromDateKey, toDateKey } from "./groups";

/** One lesson a group has a copy of, as the group's studio lists it. */
export type GroupLessonRow = {
  id: string;
  groupId: string;
  lessonId: string;
  title: string;
  unit: string;
  module: string;
  /** Postgres `date`, e.g. "2026-08-14". Null until one is set. */
  scheduledOn: string | null;
  position: number;
  updatedAt: string;
  /** The base lesson has been saved since this copy was made, so the copy is
   *  behind. False when `base_synced_at` was never recorded — unknown is not the
   *  same as stale, and offering to rebuild on a guess would risk the teacher's
   *  additions for nothing. */
  baseIsNewer: boolean;
  /** How many blocks and slides this group has added on top. */
  advancedCount: number;
};

type Embedded<T> = T | T[] | null;

/** PostgREST returns an embedded to-one either as an object or as a
 *  one-element array, depending on how it resolves the relationship. */
function one<T>(embedded: Embedded<T>): T | undefined {
  return Array.isArray(embedded) ? embedded[0] : (embedded ?? undefined);
}

type GroupLessonRecord = {
  id: string;
  group_id: string;
  lesson_id: string;
  document: Lesson | null;
  scheduled_on: string | null;
  position: number | null;
  base_synced_at: string | null;
  updated_at: string;
  lesson: Embedded<{
    title?: string | null;
    unit?: string | null;
    module?: string | null;
    updated_at?: string | null;
  }>;
};

const LIST_SELECT =
  "id, group_id, lesson_id, document, scheduled_on, position, base_synced_at, updated_at, lesson:lessons (title, unit, module, updated_at)";

/**
 * Every lesson this group has a copy of, in the group's own running order.
 *
 * `document` is selected in full so `advancedCount` can be tallied here rather
 * than by a second round trip per row — the same reason `listGroups` counts in
 * JS. These are tens of documents at most, one module's worth.
 */
export async function listGroupLessons(
  groupId: string,
): Promise<GroupLessonRow[]> {
  const { data, error } = await supabase
    .from("group_lessons")
    .select(LIST_SELECT)
    .eq("group_id", groupId)
    .order("position", { ascending: true })
    .order("scheduled_on", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as GroupLessonRecord[]).map((record) => {
    const lesson = one(record.lesson);
    const baseUpdatedAt = lesson?.updated_at ?? null;

    return {
      id: record.id,
      groupId: record.group_id,
      lessonId: record.lesson_id,
      title: lesson?.title ?? record.document?.title ?? "",
      unit: lesson?.unit ?? record.document?.unit ?? "",
      module: lesson?.module ?? record.document?.module ?? "",
      scheduledOn: record.scheduled_on,
      position: record.position ?? 0,
      updatedAt: record.updated_at,
      baseIsNewer:
        !!record.base_synced_at &&
        !!baseUpdatedAt &&
        baseUpdatedAt > record.base_synced_at,
      advancedCount: record.document ? advancedCount(record.document) : 0,
    };
  });
}

/** A copy as the Studio library lists it — across every group, so the row has to
 *  say which one it belongs to. */
export type LibraryAdvancedRow = GroupLessonRow & {
  groupName: string;
};

/**
 * Every copy the caller can see, newest edit first.
 *
 * The Studio's fourth tab. Nothing is created from there — a copy exists because
 * a group was given a module — but "where did I put that block?" is a question
 * asked from the library, not from a group you would have to remember first.
 */
export async function listAllGroupLessons(): Promise<LibraryAdvancedRow[]> {
  const { data, error } = await supabase
    .from("group_lessons")
    .select(`${LIST_SELECT}, group:groups (name)`)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as (GroupLessonRecord & {
    group: Embedded<{ name?: string | null }>;
  })[]).map((record) => {
    const lesson = one(record.lesson);
    const baseUpdatedAt = lesson?.updated_at ?? null;

    return {
      id: record.id,
      groupId: record.group_id,
      groupName: one(record.group)?.name ?? "",
      lessonId: record.lesson_id,
      title: lesson?.title ?? record.document?.title ?? "",
      unit: lesson?.unit ?? record.document?.unit ?? "",
      module: lesson?.module ?? record.document?.module ?? "",
      scheduledOn: record.scheduled_on,
      position: record.position ?? 0,
      updatedAt: record.updated_at,
      baseIsNewer:
        !!record.base_synced_at &&
        !!baseUpdatedAt &&
        baseUpdatedAt > record.base_synced_at,
      advancedCount: record.document ? advancedCount(record.document) : 0,
    };
  });
}

/** A class that is actually on a given day: which group, and which lesson of
 *  theirs is planned for it. */
export type ScheduledClass = {
  groupId: string;
  lessonId: string;
  /** The lesson's title, or "" if the row has lost its lesson. */
  title: string;
  scheduledOn: string;
  /** How many blocks and slides this group has added to it. */
  advancedCount: number;
};

/**
 * What is planned for each of the given dates, keyed by date.
 *
 * The dashboard's question is "what am I teaching today?", and until now the only
 * answer available was `groups.current_lesson_id` — a pointer somebody has to
 * remember to move. Now that every copy carries the date it is expected on, the
 * calendar can answer it directly.
 *
 * Every requested date gets an entry, empty ones included, so the caller can tell
 * "nothing planned" from "not asked for".
 */
export async function listScheduledOn(
  dateKeys: readonly string[],
): Promise<Map<string, ScheduledClass[]>> {
  const byDate = new Map<string, ScheduledClass[]>();
  for (const key of dateKeys) byDate.set(key, []);
  if (dateKeys.length === 0) return byDate;

  const { data, error } = await supabase
    .from("group_lessons")
    .select("group_id, lesson_id, scheduled_on, document, lesson:lessons (title)")
    .in("scheduled_on", dateKeys as string[]);

  if (error) throw new Error(error.message);

  for (const record of (data ?? []) as unknown as {
    group_id: string;
    lesson_id: string;
    scheduled_on: string;
    document: Lesson | null;
    lesson: Embedded<{ title?: string | null }>;
  }[]) {
    byDate.get(record.scheduled_on)?.push({
      groupId: record.group_id,
      lessonId: record.lesson_id,
      title: one(record.lesson)?.title ?? record.document?.title ?? "",
      scheduledOn: record.scheduled_on,
      advancedCount: record.document ? advancedCount(record.document) : 0,
    });
  }

  return byDate;
}

/** One group's copy of one lesson, for the editor. Null when the group has no
 *  copy of it — which is not an error: copies are made in the group's studio. */
export async function fetchGroupLesson(
  groupId: string,
  lessonId: string,
): Promise<{
  id: string;
  document: Lesson;
  baseSyncedAt: string | null;
  scheduledOn: string | null;
} | null> {
  const { data, error } = await supabase
    .from("group_lessons")
    .select("id, document, base_synced_at, scheduled_on")
    .eq("group_id", groupId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.document) return null;

  return {
    id: data.id as string,
    document: data.document as Lesson,
    baseSyncedAt: (data.base_synced_at as string | null) ?? null,
    scheduledOn: (data.scheduled_on as string | null) ?? null,
  };
}

/**
 * Saves the edited copy.
 *
 * `baseSyncedAt` is passed through rather than refreshed: saving your own
 * additions doesn't mean you have taken on whatever changed in the base lesson
 * meanwhile. Only a rebase moves that mark forward.
 */
export async function saveGroupLesson(
  groupId: string,
  lessonId: string,
  document: Lesson,
  baseSyncedAt: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("group_lessons")
    .update({ document, base_synced_at: baseSyncedAt })
    .eq("group_id", groupId)
    .eq("lesson_id", lessonId);

  if (error) throw new Error(error.message);
}

/**
 * The dates a group meeting on `meetsOn` would next have `count` classes on,
 * starting from `start` inclusive.
 *
 * A group with no meeting days gets no dates — the honest answer, and better
 * than spacing them a week apart as if it met on the start day.
 *
 * The 400-iteration ceiling is a guard, not a limit: it is over a year of days,
 * and it exists only so a bad `meetsOn` can't spin the browser.
 */
export function classDates(
  meetsOn: readonly number[],
  start: string,
  count: number,
): string[] {
  if (meetsOn.length === 0 || count <= 0) return [];

  const dates: string[] = [];
  const cursor = fromDateKey(start);

  for (let i = 0; i < 400 && dates.length < count; i += 1) {
    if (meetsOn.includes(cursor.getDay())) dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

/**
 * Copies lessons into a group, skipping any it already has.
 *
 * The documents are fetched one by one — `fetchCloudLesson` per id — because the
 * full document is what gets copied, and a module is a dozen lessons, not a
 * thousand. A lesson that can't be fetched is left out rather than inserted
 * empty: an empty copy would look like a lesson somebody deleted the contents of.
 *
 * `ignoreDuplicates` is the load-bearing option. It is what makes the button
 * idempotent, and what stops a second press from replacing a document a teacher
 * has been adding to.
 */
export async function addGroupLessons(
  groupId: string,
  lessons: CloudLessonSummary[],
  /** Where to start numbering dates. Omit to leave them blank. */
  options?: { meetsOn?: readonly number[]; startDate?: string },
): Promise<number> {
  if (lessons.length === 0) return 0;

  const documents = await Promise.all(
    lessons.map((lesson) => fetchCloudLesson(lesson.id)),
  );

  const dates =
    options?.startDate && options.meetsOn
      ? classDates(options.meetsOn, options.startDate, lessons.length)
      : [];

  const rows = lessons
    .map((lesson, i) => ({ lesson, document: documents[i], date: dates[i] }))
    .filter((entry) => entry.document)
    .map((entry, i) => ({
      group_id: groupId,
      lesson_id: entry.lesson.id,
      document: entry.document,
      scheduled_on: entry.date ?? null,
      // `lessons.order` is 0 for anything never placed in a curriculum; fall
      // back to the position in the list we were handed so those still come out
      // in a sensible order rather than all tied at zero.
      position: entry.lesson.order > 0 ? entry.lesson.order : i + 1,
      base_synced_at: entry.lesson.updatedAt,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("group_lessons")
    .upsert(rows, { onConflict: "group_id,lesson_id", ignoreDuplicates: true });

  if (error) throw new Error(error.message);
  return rows.length;
}

/** Sets (or clears) the date a copy is expected to be taught on. */
export async function setGroupLessonDate(
  id: string,
  scheduledOn: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("group_lessons")
    .update({ scheduled_on: scheduledOn || null })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/** Re-spaces every copy's date from a new start, in the group's running order.
 *  Written one row at a time because the value differs per row and PostgREST has
 *  no bulk UPDATE … FROM; a module's worth of writes is a fine price for a
 *  button pressed once a term. */
export async function regenerateDates(
  groupId: string,
  meetsOn: readonly number[],
  startDate: string,
): Promise<void> {
  const rows = await listGroupLessons(groupId);
  const dates = classDates(meetsOn, startDate, rows.length);

  await Promise.all(
    rows.map((row, i) => setGroupLessonDate(row.id, dates[i] ?? null)),
  );
}

/** Drops one copy. Deliberately per-row and confirmed in the UI: the document
 *  may carry blocks that exist nowhere else. */
export async function removeGroupLesson(id: string): Promise<void> {
  const { error } = await supabase.from("group_lessons").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
