// A group's own copies of what its students read: the material and the homework.
//
// The sibling of ./group-lessons, and deliberately the same shape — one row is
// one document as one class will actually get it, `base_synced_at` is how the
// app notices the shared row has moved on, and `advancedContext: true` inside
// the JSON is what marks the blocks this group added. Schema and RLS in
// supabase/migrations/0013_group_student_content.sql.
//
// What these two have that a presentation copy doesn't is `status`. A copy
// reaches students, so it is a draft until somebody says otherwise — and a
// published copy wins over the base row for the students in that group (the
// `student_lessons` / `student_homework` views do the choosing).
//
// Copying is additive and idempotent, for the same reason `addGroupLessons` is:
// pressing it twice must not replace a document a teacher has been adding to.

import type { Lesson } from "@/lib/lessons";
import { supabase } from "@/lib/supabase";
import { advancedCount, rebaseOnto } from "@/features/studio/advanced-context";
import { fetchMaterial, listMaterials } from "@/features/studio/data/materials";
import { fetchHomework } from "@/features/studio/data/homework";
import { stripTeacherContent } from "@/features/studio/strip-teacher";
import {
  toPublishStatus,
  type PublishStatus,
} from "@/features/studio/data/publishing";
import { openLessonForEditing } from "@/features/studio/data/open-lesson";

/** What every copy row carries, whichever kind it is. */
type CopyRow = {
  id: string;
  groupId: string;
  title: string;
  status: PublishStatus;
  updatedAt: string;
  /** The shared row has been saved since this copy was made. False when
   *  `base_synced_at` was never recorded — unknown is not the same as stale. */
  baseIsNewer: boolean;
  /** How many blocks and slides this group has added on top. */
  advancedCount: number;
};

/** One group's copy of a lesson's student material. */
export type GroupMaterialRow = CopyRow & {
  lessonId: string;
  unit: string;
  module: string;
};

/** One group's copy of a homework. */
export type GroupHomeworkRow = CopyRow & {
  homeworkId: string;
  /** The lesson the base homework is attached to, "" while it is unfiled. */
  lessonId: string;
  /** That lesson's title and module, read through the base homework — a copy
   *  inherits both, and the gallery groups by the module. */
  lessonTitle: string;
  module: string;
};

type Embedded<T> = T | T[] | null;

/** PostgREST returns an embedded to-one either as an object or as a
 *  one-element array, depending on how it resolves the relationship. */
function one<T>(embedded: Embedded<T>): T | undefined {
  return Array.isArray(embedded) ? embedded[0] : (embedded ?? undefined);
}

/** Base saved after the copy was taken — and only when both timestamps are
 *  known. See `GroupLessonRow.baseIsNewer`, which reads the same way. */
function isBehind(
  baseSyncedAt: string | null,
  baseUpdatedAt: string | null | undefined,
): boolean {
  return !!baseSyncedAt && !!baseUpdatedAt && baseUpdatedAt > baseSyncedAt;
}

// Materials ---------------------------------------------------------------

const MATERIAL_SELECT =
  "id, group_id, lesson_id, document, status, base_synced_at, updated_at, lesson:lessons (title, unit, module)";

type MaterialRecord = {
  id: string;
  group_id: string;
  lesson_id: string;
  document: Lesson | null;
  status: string | null;
  base_synced_at: string | null;
  updated_at: string;
  lesson: Embedded<{
    title?: string | null;
    unit?: string | null;
    module?: string | null;
  }>;
};

/**
 * @param baseUpdatedAt when the shared material for this lesson was last saved,
 * looked up by the caller. Not embedded: `group_lesson_materials` points at
 * `lessons`, not at `lesson_materials` — there is no foreign key between the two
 * copies (a group may have one before the shared row exists), so PostgREST has
 * nothing to join through and the timestamp comes from a second read.
 */
function toMaterialRow(
  record: MaterialRecord,
  baseUpdatedAt: string | undefined,
): GroupMaterialRow {
  const lesson = one(record.lesson);
  return {
    id: record.id,
    groupId: record.group_id,
    lessonId: record.lesson_id,
    title: lesson?.title ?? record.document?.title ?? "",
    unit: lesson?.unit ?? "",
    module: lesson?.module ?? "",
    status: toPublishStatus(record.status),
    updatedAt: record.updated_at,
    baseIsNewer: isBehind(record.base_synced_at, baseUpdatedAt),
    advancedCount: record.document ? advancedCount(record.document) : 0,
  };
}

/** Every material this group has a copy of. */
export async function listGroupMaterials(
  groupId: string,
): Promise<GroupMaterialRow[]> {
  const [{ data, error }, base] = await Promise.all([
    supabase
      .from("group_lesson_materials")
      .select(MATERIAL_SELECT)
      .eq("group_id", groupId),
    listMaterials(),
  ]);

  if (error) throw new Error(error.message);

  const baseUpdatedAt = new Map(base.map((m) => [m.lessonId, m.updatedAt]));
  return ((data ?? []) as unknown as MaterialRecord[]).map((record) =>
    toMaterialRow(record, baseUpdatedAt.get(record.lesson_id)),
  );
}

/** One copy, for the editor. Null when the group has no copy of it — which is
 *  not an error: copies are made from the group's Studio. */
export async function fetchGroupMaterial(
  groupId: string,
  lessonId: string,
): Promise<{
  id: string;
  document: Lesson;
  status: PublishStatus;
  baseSyncedAt: string | null;
} | null> {
  const { data, error } = await supabase
    .from("group_lesson_materials")
    .select("id, document, status, base_synced_at")
    .eq("group_id", groupId)
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.document) return null;

  return {
    id: data.id as string,
    document: data.document as Lesson,
    status: toPublishStatus(data.status),
    baseSyncedAt: (data.base_synced_at as string | null) ?? null,
  };
}

/**
 * Saves the edited copy.
 *
 * `baseSyncedAt` is passed through rather than refreshed, and `status` is left
 * out of the payload entirely — for the same two reasons the base editors do it:
 * saving your additions is not taking on the base's changes, and editing a
 * published document is not retracting it.
 */
export async function saveGroupMaterial(
  groupId: string,
  lessonId: string,
  document: Lesson,
  baseSyncedAt: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("group_lesson_materials")
    .update({ document, base_synced_at: baseSyncedAt })
    .eq("group_id", groupId)
    .eq("lesson_id", lessonId);

  if (error) throw new Error(error.message);
}

/**
 * Rebuilds this group's material on the shared material as it stands now.
 *
 * The list's version of the editor's "Refresh from base" — see
 * `rebaseGroupLesson`, which reads the same way. A group whose material was
 * seeded from the presentation (no shared material of its own) has nothing to
 * rebuild from, and says so rather than writing anything.
 */
export async function rebaseGroupMaterial(
  groupId: string,
  lessonId: string,
): Promise<void> {
  const [copy, base] = await Promise.all([
    fetchGroupMaterial(groupId, lessonId),
    fetchMaterial(lessonId),
  ]);

  if (!copy) throw new Error("This group has no copy of that material.");
  if (!base) {
    throw new Error("There's no shared material for this lesson to rebuild on.");
  }

  await saveGroupMaterial(
    groupId,
    lessonId,
    rebaseOnto(base.document, copy.document),
    base.updatedAt || null,
  );
}

export async function setGroupMaterialStatus(
  id: string,
  status: PublishStatus,
): Promise<void> {
  const { error } = await supabase
    .from("group_lesson_materials")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/** Drops one copy. The shared material is untouched, and the group's students
 *  fall back to reading it. */
export async function removeGroupMaterial(id: string): Promise<void> {
  const { error } = await supabase
    .from("group_lesson_materials")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * Copies the material for these lessons into a group, skipping any it has.
 *
 * A lesson with no material of its own is seeded from the presentation with the
 * teacher's half removed — the same starting point the base editor offers, and
 * better than an empty document that looks like content somebody deleted.
 * A lesson with neither is left out rather than copied blank.
 */
export async function addGroupMaterials(
  groupId: string,
  lessonIds: readonly string[],
): Promise<number> {
  if (lessonIds.length === 0) return 0;

  const seeds = await Promise.all(
    lessonIds.map(async (lessonId) => {
      const base = await fetchMaterial(lessonId);
      if (base) {
        return {
          lessonId,
          document: base.document,
          baseSyncedAt: base.updatedAt || null,
        };
      }
      const lesson = await openLessonForEditing(lessonId);
      return lesson
        ? { lessonId, document: stripTeacherContent(lesson), baseSyncedAt: null }
        : null;
    }),
  );

  const rows = seeds
    .filter((seed): seed is NonNullable<typeof seed> => seed !== null)
    .map((seed) => ({
      group_id: groupId,
      lesson_id: seed.lessonId,
      document: seed.document,
      base_synced_at: seed.baseSyncedAt,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("group_lesson_materials")
    .upsert(rows, { onConflict: "group_id,lesson_id", ignoreDuplicates: true });

  if (error) throw new Error(error.message);
  return rows.length;
}

// Homework ----------------------------------------------------------------

const HOMEWORK_SELECT =
  "id, group_id, homework_id, document, status, base_synced_at, updated_at, base:homework (title, lesson_id, updated_at, lesson:lessons (title, unit, module))";

type HomeworkRecord = {
  id: string;
  group_id: string;
  homework_id: string;
  document: Lesson | null;
  status: string | null;
  base_synced_at: string | null;
  updated_at: string;
  base: Embedded<{
    title?: string | null;
    lesson_id?: string | null;
    updated_at?: string | null;
    // Nested embed: the homework's own foreign key to the lesson it is filed
    // under. A copy has no module of its own — it inherits the one the base
    // homework's lesson is in, which is what the gallery groups by.
    lesson: Embedded<{
      title?: string | null;
      unit?: string | null;
      module?: string | null;
    }>;
  }>;
};

function toHomeworkRow(record: HomeworkRecord): GroupHomeworkRow {
  const base = one(record.base);
  const lesson = one(base?.lesson ?? null);
  return {
    id: record.id,
    groupId: record.group_id,
    homeworkId: record.homework_id,
    title: base?.title ?? record.document?.title ?? "",
    lessonId: base?.lesson_id ?? "",
    lessonTitle: lesson?.title ?? "",
    module: lesson?.module ?? "",
    status: toPublishStatus(record.status),
    updatedAt: record.updated_at,
    baseIsNewer: isBehind(record.base_synced_at, base?.updated_at),
    advancedCount: record.document ? advancedCount(record.document) : 0,
  };
}

export async function listGroupHomework(
  groupId: string,
): Promise<GroupHomeworkRow[]> {
  const { data, error } = await supabase
    .from("group_homework")
    .select(HOMEWORK_SELECT)
    .eq("group_id", groupId);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as HomeworkRecord[]).map(toHomeworkRow);
}

export async function fetchGroupHomework(
  groupId: string,
  homeworkId: string,
): Promise<{
  id: string;
  document: Lesson;
  status: PublishStatus;
  baseSyncedAt: string | null;
} | null> {
  const { data, error } = await supabase
    .from("group_homework")
    .select("id, document, status, base_synced_at")
    .eq("group_id", groupId)
    .eq("homework_id", homeworkId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.document) return null;

  return {
    id: data.id as string,
    document: data.document as Lesson,
    status: toPublishStatus(data.status),
    baseSyncedAt: (data.base_synced_at as string | null) ?? null,
  };
}

export async function saveGroupHomework(
  groupId: string,
  homeworkId: string,
  document: Lesson,
  baseSyncedAt: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("group_homework")
    .update({ document, base_synced_at: baseSyncedAt })
    .eq("group_id", groupId)
    .eq("homework_id", homeworkId);

  if (error) throw new Error(error.message);
}

/** Rebuilds this group's homework on the shared homework as it stands now.
 *  See `rebaseGroupMaterial` — the same move, keyed by the homework's slug. */
export async function rebaseGroupHomework(
  groupId: string,
  homeworkId: string,
): Promise<void> {
  const [copy, base] = await Promise.all([
    fetchGroupHomework(groupId, homeworkId),
    fetchHomework(homeworkId),
  ]);

  if (!copy) throw new Error("This group has no copy of that homework.");
  if (!base) {
    throw new Error("The shared homework is no longer there to rebuild from.");
  }

  await saveGroupHomework(
    groupId,
    homeworkId,
    rebaseOnto(base.document, copy.document),
    base.updatedAt || null,
  );
}

export async function setGroupHomeworkStatus(
  id: string,
  status: PublishStatus,
): Promise<void> {
  const { error } = await supabase
    .from("group_homework")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function removeGroupHomework(id: string): Promise<void> {
  const { error } = await supabase.from("group_homework").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Copies these homeworks into a group, skipping any it already has. */
export async function addGroupHomework(
  groupId: string,
  homeworkIds: readonly string[],
): Promise<number> {
  if (homeworkIds.length === 0) return 0;

  const bases = await Promise.all(homeworkIds.map((id) => fetchHomework(id)));

  const rows = bases
    .filter((base): base is NonNullable<typeof base> => base !== null)
    .map((base) => ({
      group_id: groupId,
      homework_id: base.id,
      document: base.document,
      base_synced_at: base.updatedAt || null,
    }));

  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("group_homework")
    .upsert(rows, {
      onConflict: "group_id,homework_id",
      ignoreDuplicates: true,
    });

  if (error) throw new Error(error.message);
  return rows.length;
}
