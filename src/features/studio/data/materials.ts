// Admin-side access to student materials — the student-facing copy of a lesson.
//
// One row per lesson, keyed by `lesson_id` (see
// supabase/migrations/0004_student_materials_and_homework.sql). The table is
// admin-only under RLS; the student reads the `student_lessons` view instead,
// through @/lib/student-content.
//
// A material carries no title or module of its own — those belong to the lesson
// and are read from it, so there is no second copy to drift out of step. That is
// the mistake `lessons.module` already makes, and 0003 exists to paper over.

import { supabase } from "@/lib/supabase";
import type { Lesson } from "@/lib/lessons";
import { toPublishStatus, type PublishStatus } from "./publishing";

export type MaterialSummary = {
  lessonId: string;
  status: PublishStatus;
  updatedAt: string;
};

export type Material = MaterialSummary & {
  /** The student-facing document — the same shape as a lesson, minus whatever
   *  the write trigger stripped. */
  document: Lesson;
};

/** The material for a lesson, or null when none has been written yet. */
export async function fetchMaterial(
  lessonId: string,
): Promise<Material | null> {
  const { data, error } = await supabase
    .from("lesson_materials")
    .select("lesson_id, document, status, updated_at")
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    lessonId: data.lesson_id as string,
    document: data.document as Lesson,
    status: toPublishStatus(data.status),
    updatedAt: (data.updated_at as string | null) ?? "",
  };
}

/**
 * Writes the material for a lesson, creating it on first save.
 *
 * `status` is deliberately absent from the payload: on insert the column
 * defaults to 'draft', and on update leaving it out is what stops every save
 * from unpublishing what the student is currently reading. Publishing is its own
 * action — see {@link setMaterialStatus}.
 */
export async function saveMaterial(
  lessonId: string,
  document: Lesson,
): Promise<void> {
  const { error } = await supabase
    .from("lesson_materials")
    .upsert({ lesson_id: lessonId, document }, { onConflict: "lesson_id" });

  if (error) throw new Error(error.message);
}

/** Every material, without its document — enough to show status in the library. */
export async function listMaterials(): Promise<MaterialSummary[]> {
  const { data, error } = await supabase
    .from("lesson_materials")
    .select("lesson_id, status, updated_at");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    lessonId: row.lesson_id as string,
    status: toPublishStatus(row.status),
    updatedAt: (row.updated_at as string | null) ?? "",
  }));
}

/** Publishes or unpublishes a material. Unpublishing takes it off `/learn` at
 *  once — the view filters on this column. */
export async function setMaterialStatus(
  lessonId: string,
  status: PublishStatus,
): Promise<void> {
  const { error } = await supabase
    .from("lesson_materials")
    .update({ status })
    .eq("lesson_id", lessonId);

  if (error) throw new Error(error.message);
}

/** Deletes the student's copy of a lesson. The lesson itself is untouched. */
export async function deleteMaterial(lessonId: string): Promise<void> {
  const { error } = await supabase
    .from("lesson_materials")
    .delete()
    .eq("lesson_id", lessonId);

  if (error) throw new Error(error.message);
}
