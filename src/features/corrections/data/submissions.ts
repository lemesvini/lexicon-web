// Teacher-side access to what students have handed in.
//
// Reads and grading go straight to `homework_submissions` under the staff RLS
// policy (see supabase/migrations/0005_homework_exercises.sql, rescoped by
// 0006). There is no RPC on this side and there doesn't need to be: the
// functions on the student's side exist to stop them writing columns that aren't
// theirs, and whoever teaches a student is trusted with every column on their
// row.
//
// The queue below is not filtered by teacher here, and shouldn't be: a
// submission reaches whoever the student belongs to, and the admin, because the
// policy says so. Adding a client-side filter would only be a second, weaker
// copy of that rule.

import { supabase } from "@/lib/supabase";
import type { AnswerValue, Lesson } from "@/lib/lessons";
import type { SubmissionStatus } from "@/lib/student-content";

export type SubmissionRow = {
  id: string;
  homeworkId: string;
  /** Never empty — falls back to the slug when the homework has no title. */
  homeworkTitle: string;
  /** The lesson the homework is filed under, and its module. Read through the
   *  homework rather than stored on the submission: it is what tells two
   *  homeworks with similar names apart in the queue. */
  lessonTitle: string;
  module: string;
  studentName: string;
  status: SubmissionStatus;
  score: number | null;
  /** Empty while the student is still working on it. */
  submittedAt: string;
  gradedAt: string | null;
};

/** A submission opened for marking: the answers, and the homework they answer. */
export type SubmissionDetail = SubmissionRow & {
  answers: Record<string, AnswerValue>;
  /** What the objective answers were when it was handed in. */
  answerKey: Record<string, AnswerValue>;
  marks: Record<string, boolean>;
  feedback: string;
  blockNotes: Record<string, string>;
  /** The homework document, with the answer key intact — this is the admin's
   *  copy, straight from the table rather than through the student's view. */
  document: Lesson;
};

/** PostgREST returns an embedded to-one either as an object or a one-element
 *  array, depending on how it resolves the relationship. */
function one<T>(embedded: T | T[] | null): T | undefined {
  return Array.isArray(embedded) ? embedded[0] : (embedded ?? undefined);
}

type LessonEmbed = { title: string | null; module: string | null };

type HomeworkEmbed = {
  title: string | null;
  lesson: LessonEmbed | LessonEmbed[] | null;
};

type Record_ = {
  id: string;
  homework_id: string;
  status: string | null;
  score: number | null;
  submitted_at: string | null;
  graded_at: string | null;
  homework: HomeworkEmbed | HomeworkEmbed[] | null;
  student: { full_name: string | null } | { full_name: string | null }[] | null;
};

function toStatus(raw: unknown): SubmissionStatus {
  return raw === "submitted" || raw === "graded" ? raw : "in_progress";
}

function toRow(record: Record_): SubmissionRow {
  const homework = one(record.homework);
  const lesson = one(homework?.lesson ?? null);

  return {
    id: record.id,
    homeworkId: record.homework_id,
    // `||`, not `??`: an untitled homework has an empty string in the column,
    // not a null, and a blank cell in the queue identifies nothing.
    homeworkTitle: homework?.title || record.homework_id,
    lessonTitle: lesson?.title ?? "",
    module: lesson?.module ?? "",
    studentName: one(record.student)?.full_name ?? "—",
    status: toStatus(record.status),
    score: record.score,
    submittedAt: record.submitted_at ?? "",
    gradedAt: record.graded_at,
  };
}

/**
 * The scalar columns both queries need. The embeds are spelled out per query
 * rather than shared: the detail view wants the homework's `document` too, and
 * naming the same embed alias twice in one select is an error, not a merge.
 */
const BASE_COLUMNS = "id, homework_id, status, score, submitted_at, graded_at";

/** The lesson comes through the homework's own foreign key — a submission has
 *  no link to a lesson of its own, and shouldn't grow one. */
const HOMEWORK_EMBED = "lesson:lessons (title, module)";

const LIST_COLUMNS = `${BASE_COLUMNS}, homework:homework (title, ${HOMEWORK_EMBED}), student:students (full_name)`;

const DETAIL_COLUMNS = `${BASE_COLUMNS}, answers, answer_key, marks, feedback, block_notes, homework:homework (title, document, ${HOMEWORK_EMBED}), student:students (full_name)`;

/**
 * Everything handed in, oldest first — a queue rather than a feed. Work that has
 * only been started is included too: knowing who has opened a homework and gone
 * quiet is worth as much as knowing who has finished.
 */
export async function listSubmissions(): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from("homework_submissions")
    .select(LIST_COLUMNS)
    .order("submitted_at", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record_[]).map(toRow);
}

export async function fetchSubmission(
  id: string,
): Promise<SubmissionDetail | null> {
  const { data, error } = await supabase
    .from("homework_submissions")
    .select(DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  // `homework` is re-declared with the document attached, so the embed is
  // omitted from the base shape rather than intersected with it — an
  // intersection would keep the narrower shape and hide `document`.
  type DetailHomework = HomeworkEmbed & { document: Lesson };

  const record = data as Omit<Record_, "homework"> & {
    answers: Record<string, AnswerValue> | null;
    answer_key: Record<string, AnswerValue> | null;
    marks: Record<string, boolean> | null;
    feedback: string | null;
    block_notes: Record<string, string> | null;
    homework: DetailHomework | DetailHomework[] | null;
  };

  return {
    ...toRow(record),
    answers: record.answers ?? {},
    answerKey: record.answer_key ?? {},
    marks: record.marks ?? {},
    feedback: record.feedback ?? "",
    blockNotes: record.block_notes ?? {},
    document: one(record.homework)?.document ?? {
      id: "",
      unit: "",
      module: "",
      title: "",
      context: "",
      minorCanDo: "",
      grammarFocus: [],
      classPlan: [],
      slides: [],
    },
  };
}

/** Marks it, and releases the whole correction to the student in one write. */
export async function gradeSubmission(
  id: string,
  input: {
    score: number | null;
    feedback: string;
    blockNotes: Record<string, string>;
  },
): Promise<void> {
  const { error } = await supabase
    .from("homework_submissions")
    .update({
      score: input.score,
      feedback: input.feedback.trim() || null,
      block_notes: input.blockNotes,
      status: "graded",
      graded_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * Hands it back for another go. The mark and the notes are kept rather than
 * cleared — they are the reason the student is being asked to redo it, and
 * `student_submissions` withholds them again the moment the status changes.
 */
export async function reopenSubmission(id: string): Promise<void> {
  const { error } = await supabase
    .from("homework_submissions")
    .update({ status: "in_progress", graded_at: null })
    .eq("id", id);

  if (error) throw new Error(error.message);
}
