// Admin-side access to homework.
//
// Unlike a material, homework has its own slug id and its own title: it is
// authored on its own and attached to a lesson afterwards (or never). See
// supabase/migrations/0004_student_materials_and_homework.sql — `lesson_id` is
// nullable, and the student view joins through it, so an unattached homework is
// invisible to students no matter its status.

import { supabase } from "@/lib/supabase";
import type { Lesson } from "@/lib/lessons";
import { toPublishStatus, type PublishStatus } from "./publishing";

export type HomeworkSummary = {
  id: string;
  title: string;
  /** The lesson it is attached to, or null while it is unfiled. */
  lessonId: string | null;
  status: PublishStatus;
  updatedAt: string;
};

export async function listHomework(): Promise<HomeworkSummary[]> {
  const { data, error } = await supabase
    .from("homework")
    .select("id, title, lesson_id, status, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: (row.title as string | null) ?? "",
    lessonId: (row.lesson_id as string | null) ?? null,
    status: toPublishStatus(row.status),
    updatedAt: (row.updated_at as string | null) ?? "",
  }));
}

export type Homework = HomeworkSummary & { document: Lesson };

export async function fetchHomework(id: string): Promise<Homework | null> {
  const { data, error } = await supabase
    .from("homework")
    .select("id, title, lesson_id, document, status, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id as string,
    title: (data.title as string | null) ?? "",
    lessonId: (data.lesson_id as string | null) ?? null,
    document: data.document as Lesson,
    status: toPublishStatus(data.status),
    updatedAt: (data.updated_at as string | null) ?? "",
  };
}

/**
 * Writes a homework, creating it on first save. Keyed by its slug id, so saving
 * under a different id creates a second homework rather than renaming the first
 * — the same upsert-on-id behaviour lessons have.
 *
 * `status` stays out of the payload for the same reason it does when saving a
 * material: editing published homework must not silently retract it.
 */
export async function saveHomework(input: {
  id: string;
  title: string;
  lessonId: string | null;
  document: Lesson;
}): Promise<void> {
  const { error } = await supabase.from("homework").upsert(
    {
      id: input.id,
      title: input.title,
      lesson_id: input.lessonId,
      document: input.document,
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);
}

export async function setHomeworkStatus(
  id: string,
  status: PublishStatus,
): Promise<void> {
  const { error } = await supabase
    .from("homework")
    .update({ status })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * Attaches a homework to a lesson, or unfiles it when `lessonId` is null.
 *
 * A plain column write is enough here, unlike the module moves in 0003: the link
 * is a real foreign key to a stable primary key, and it exists in exactly one
 * place. Nothing to keep in step, so nothing to do in a transaction.
 */
export async function setHomeworkLesson(
  id: string,
  lessonId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("homework")
    .update({ lesson_id: lessonId })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function deleteHomework(id: string): Promise<void> {
  const { error } = await supabase.from("homework").delete().eq("id", id);

  if (error) throw new Error(error.message);
}
