// The client-side twin of `strip_teacher_content` in
// supabase/migrations/0004_student_materials_and_homework.sql.
//
// The database is the guarantee: the trigger runs on every write to
// `lesson_materials` and `homework`, so teacher-only content cannot be stored in
// a student document however it was submitted. This function exists so the
// editor shows the same thing the save will produce — seeding a material from a
// presentation and then watching the answer keys vanish on reload would be a
// worse experience than never showing them.
//
// If the two ever disagree, the database wins and this one is the bug.

import type { Lesson } from "@/lib/lessons";
import { isTeacherOnly } from "@/features/blocks";

/** A copy of `lesson` with teacher notes and teacher-only blocks removed. */
export function stripTeacherContent(lesson: Lesson): Lesson {
  return {
    ...lesson,
    // Spread-and-delete rather than listing the fields to keep: a slide that
    // grows a new field later should carry it through by default, not be
    // silently trimmed by a copy written before that field existed.
    slides: (lesson.slides ?? []).map((slide) => {
      const stripped = {
        ...slide,
        blocks: (slide.blocks ?? []).filter((block) => !isTeacherOnly(block)),
      };
      delete stripped.teacherNotes;
      return stripped;
    }),
  };
}
