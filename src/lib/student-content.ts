// What a student reads: their lessons' material, and the homework attached to
// it.
//
// Everything here goes through the `student_lessons` / `student_homework` /
// `student_presentations` views (see 0004_student_materials_and_homework.sql and
// 0018_student_presentations.sql), never the underlying tables — those are
// admin-only. The views are already filtered to the caller's module and to
// published rows, so there is nothing to filter here and no client-side check to
// get wrong.
//
// Sibling to @/lib/lessons-cloud, which is the admin's view of the same library.

import { supabase } from "@/lib/supabase";
import type { AnswerValue, Lesson } from "@/lib/lessons";

/** A lesson in the student's module, without its document — enough for the list. */
export type StudentLessonSummary = {
  id: string;
  title: string;
  unit: string;
  module: string;
  /** Curriculum order within the module (`lessons.position`). */
  position: number;
  updatedAt: string;
};

/** A lesson with the material the student actually reads. */
export type StudentLesson = StudentLessonSummary & {
  /** The student-facing document. Same shape as a lesson (meta + slides), but
   *  authored separately and stripped of anything teacher-only on write. */
  document: Lesson;
};

export type StudentHomework = {
  id: string;
  title: string;
  lessonId: string;
  /** The lesson it belongs to — shown as context, since homework is listed on
   *  its own rather than under the lesson. */
  lessonTitle: string;
  module: string;
  /** Its lesson's place in the module — what the list is ordered by. */
  position: number;
  document: Lesson;
  updatedAt: string;
};

/** How far along the student is on one homework. */
export type SubmissionStatus = "in_progress" | "submitted" | "graded";

/**
 * The student's own submission. Everything the correction produced is withheld
 * by the `student_submissions` view until the status is 'graded' — so a null
 * score here means "not marked yet", never "marked zero".
 */
export type StudentSubmission = {
  id: string;
  homeworkId: string;
  /** { blockId: answer } */
  answers: Record<string, AnswerValue>;
  status: SubmissionStatus;
  /** { blockId: was it right } — empty until graded. */
  marks: Record<string, boolean>;
  /** { blockId: the right answer } — empty until graded. */
  answerKey: Record<string, AnswerValue>;
  score: number | null;
  feedback: string | null;
  /** { blockId: the teacher's note } — empty until graded. */
  blockNotes: Record<string, string>;
  submittedAt: string | null;
  gradedAt: string | null;
};

const SUMMARY_COLUMNS = "id, title, unit, module, position, updated_at";

type SummaryRecord = {
  id: string;
  title: string | null;
  unit: string | null;
  module: string | null;
  position: number | null;
  updated_at: string | null;
};

function toSummary(record: SummaryRecord): StudentLessonSummary {
  return {
    id: record.id,
    title: record.title ?? "",
    unit: record.unit ?? "",
    module: record.module ?? "",
    position: record.position ?? 0,
    updatedAt: record.updated_at ?? "",
  };
}

/**
 * Curriculum order: `course_order` ascending, with unplaced rows last.
 *
 * Not `position` — that restarts at 1 inside each unit, so sorting by it deals
 * the units into each other (see 0020). Not the database's job either: `order
 * by course_order` puts every unplaced 0 first, and PostgREST has nowhere to put
 * the expression that wouldn't. A module is a few dozen rows.
 */
function byCourseOrder(
  a: { course_order: number | null; title: string | null },
  b: { course_order: number | null; title: string | null },
): number {
  const rank = (order: number | null) =>
    order && order > 0 ? order : Number.MAX_SAFE_INTEGER;
  return (
    rank(a.course_order) - rank(b.course_order) ||
    (a.title ?? "").localeCompare(b.title ?? "")
  );
}

/** A lesson as the syllabus lists it: in the module, whether or not it can be
 *  opened yet. */
export type StudentSyllabusEntry = Omit<StudentLessonSummary, "updatedAt"> & {
  /** Whether material has been published for it. A lesson that isn't available
   *  is listed and greyed out — it is the course the student was sold, not a
   *  lesson being withheld. */
  available: boolean;
};

/**
 * Every lesson in the student's module, in curriculum order, open or not.
 *
 * The list the student sees. `student_syllabus` (0020) carries no document, so
 * a lesson that isn't `available` is a title and nothing more — reading one
 * still goes through {@link fetchStudentLesson}, which answers from
 * `student_lessons` and so refuses.
 */
export async function listStudentSyllabus(): Promise<StudentSyllabusEntry[]> {
  const { data, error } = await supabase
    .from("student_syllabus")
    .select("id, title, unit, module, position, course_order, available");

  if (error) throw new Error(error.message);

  type Record_ = SummaryRecord & { course_order: number | null; available: boolean };

  // The view carries no `updated_at` — there is nothing to date about a lesson
  // that hasn't been written yet — so the summary is built by hand rather than
  // through `toSummary`, which would only invent one.
  return ((data ?? []) as Record_[]).sort(byCourseOrder).map((record) => ({
    id: record.id,
    title: record.title ?? "",
    unit: record.unit ?? "",
    module: record.module ?? "",
    position: record.position ?? 0,
    available: record.available,
  }));
}

/**
 * One lesson with its material, or null when the student may not read it —
 * wrong module, or the material isn't published. The two are indistinguishable
 * from here on purpose: a student has no business learning that a lesson exists
 * but is closed to them.
 */
export async function fetchStudentLesson(
  id: string,
): Promise<StudentLesson | null> {
  const { data, error } = await supabase
    .from("student_lessons")
    .select(`${SUMMARY_COLUMNS}, document`)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    ...toSummary(data as SummaryRecord),
    document: (data as { document: Lesson }).document,
  };
}

/**
 * The deck the class was actually shown: their group's copy of the presentation
 * when the group has one, else the shared lesson — scrubbed of teacher notes and
 * answer keys by the view itself (see migration 0018).
 *
 * Returns null when the student may not read it, which is the same set of
 * lessons `fetchStudentLesson` returns null for: `student_presentations` gates
 * on `student_lessons`, so a lesson with no page has no deck.
 */
export async function fetchStudentPresentation(
  lessonId: string,
): Promise<Lesson | null> {
  const { data, error } = await supabase
    .from("student_presentations")
    .select("document")
    .eq("id", lessonId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? ((data as { document: Lesson }).document ?? null) : null;
}

type HomeworkRecord = {
  id: string;
  title: string | null;
  lesson_id: string;
  lesson_title: string | null;
  module: string | null;
  position: number | null;
  course_order: number | null;
  document: Lesson;
  updated_at: string | null;
};

function toHomework(row: HomeworkRecord): StudentHomework {
  return {
    id: row.id,
    title: row.title ?? "",
    position: row.position ?? 0,
    lessonId: row.lesson_id,
    lessonTitle: row.lesson_title ?? "",
    module: row.module ?? "",
    document: row.document,
    updatedAt: row.updated_at ?? "",
  };
}

const HOMEWORK_COLUMNS =
  "id, title, lesson_id, lesson_title, module, position, course_order, document, updated_at";

/**
 * Every homework the student can reach, in course order.
 *
 * Scoped by module, not by lesson: homework has its own place in the student's
 * app, but it still reaches them *through* a lesson — the view joins on
 * `lesson_id` to work out whose module it belongs to, which is why an unattached
 * homework is invisible however published it is.
 */
export async function listStudentHomework(): Promise<StudentHomework[]> {
  const { data, error } = await supabase
    .from("student_homework")
    .select(HOMEWORK_COLUMNS);

  if (error) throw new Error(error.message);

  // Its lesson's place in the course, then its own title — the order the course
  // is taught in. It used to be `updated_at`, which is the order things were
  // last edited: re-saving lesson two's homework sent it to the bottom.
  return ((data ?? []) as HomeworkRecord[]).sort(byCourseOrder).map(toHomework);
}

/** One homework, or null when it isn't the student's to open. */
export async function fetchStudentHomework(
  id: string,
): Promise<StudentHomework | null> {
  const { data, error } = await supabase
    .from("student_homework")
    .select(HOMEWORK_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toHomework(data as HomeworkRecord) : null;
}

type SubmissionRecord = {
  id: string;
  homework_id: string;
  answers: Record<string, AnswerValue> | null;
  status: string | null;
  marks: Record<string, boolean> | null;
  answer_key: Record<string, AnswerValue> | null;
  score: number | null;
  feedback: string | null;
  block_notes: Record<string, string> | null;
  submitted_at: string | null;
  graded_at: string | null;
};

function toSubmission(row: SubmissionRecord): StudentSubmission {
  return {
    id: row.id,
    homeworkId: row.homework_id,
    answers: row.answers ?? {},
    status:
      row.status === "submitted" || row.status === "graded"
        ? row.status
        : "in_progress",
    marks: row.marks ?? {},
    answerKey: row.answer_key ?? {},
    score: row.score,
    feedback: row.feedback,
    blockNotes: row.block_notes ?? {},
    submittedAt: row.submitted_at,
    gradedAt: row.graded_at,
  };
}

const SUBMISSION_COLUMNS =
  "id, homework_id, answers, status, marks, answer_key, score, feedback, block_notes, submitted_at, graded_at";

/** The student's own submissions, keyed by homework id. */
export async function listMySubmissions(): Promise<
  Map<string, StudentSubmission>
> {
  const { data, error } = await supabase
    .from("student_submissions")
    .select(SUBMISSION_COLUMNS);

  if (error) throw new Error(error.message);

  const byHomework = new Map<string, StudentSubmission>();
  for (const row of (data ?? []) as SubmissionRecord[]) {
    byHomework.set(row.homework_id, toSubmission(row));
  }
  return byHomework;
}

/** The student's submission for one homework, or null if they haven't started. */
export async function fetchMySubmission(
  homeworkId: string,
): Promise<StudentSubmission | null> {
  const { data, error } = await supabase
    .from("student_submissions")
    .select(SUBMISSION_COLUMNS)
    .eq("homework_id", homeworkId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toSubmission(data as SubmissionRecord) : null;
}

/**
 * Saves work in progress. Refused by the server once the homework has been
 * handed in — a stale tab must not rewrite an answer already being marked.
 */
export async function saveMyAnswers(
  homeworkId: string,
  answers: Record<string, AnswerValue>,
): Promise<void> {
  const { error } = await supabase.rpc("save_homework_answers", {
    p_homework_id: homeworkId,
    p_answers: answers,
  });

  if (error) throw new Error(error.message);
}

/** Hands it in. The server snapshots the answer key and does the marking. */
export async function submitMyAnswers(
  homeworkId: string,
  answers: Record<string, AnswerValue>,
): Promise<void> {
  const { error } = await supabase.rpc("submit_homework", {
    p_homework_id: homeworkId,
    p_answers: answers,
  });

  if (error) throw new Error(error.message);
}
