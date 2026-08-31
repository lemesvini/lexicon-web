// Everything the school knows about one student, in one read.
//
// The roster (`./students.ts`) answers "who is here?"; this answers "how is this
// one doing?" — which is a different question and, more to the point, a
// different set of tables: their homework, their register, the modules they've
// been through, the groups they sit in.
//
// No new RLS to think about. Every table here is already scoped by 0006/0007 —
// `owns_student()` on the submissions and the module history, `owns_group()` on
// the attendance — so a teacher opening a student who isn't theirs gets an empty
// dossier rather than someone else's marks, and the admin gets everything. The
// `students` row itself is the gate: it comes back null when the caller can't
// see them, and the page says "no such student" on that alone.
//
// Five queries in parallel rather than one view: PostgREST can't aggregate, the
// numbers below are counted over tens of rows, and a view would have to be kept
// in step with policies that already say the right thing.

import { supabase } from "@/lib/supabase";
import type { SubmissionStatus } from "@/lib/student-content";
import type { StudentStatus } from "@/features/students/data/students";

type Embedded<T> = T | T[] | null;

/** PostgREST returns an embedded to-one either as an object or as a
 *  one-element array, depending on how it resolves the relationship. */
function one<T>(embedded: Embedded<T>): T | undefined {
  return Array.isArray(embedded) ? embedded[0] : (embedded ?? undefined);
}

/**
 * `numeric` can come back from PostgREST as a string — a JSON number can't hold
 * every value the column can. Both `score` and `monthly_fee` are numeric, and
 * both are averaged or totalled here, so neither can be left as "probably a
 * number".
 */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
}

/** The student themselves — the roster row, plus the columns the roster has no
 *  width for. */
export type StudentProfile = {
  id: string;
  /** Null until an auth account exists for them. */
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  status: StudentStatus;
  moduleId: string | null;
  /** Module name, or "" when they haven't been placed in one. */
  module: string;
  teacherId: string | null;
  teacher: string;
  /** Free-text staff note. Editable from the dashboard — see {@link setStudentNotes}. */
  notes: string;
  /** Storage object path of their picture, or "" for none. See @/lib/avatars. */
  avatarPath: string;
  /** Null until someone has priced them up — not zero. */
  monthlyFee: number | null;
  classesPerWeek: number | null;
  createdAt: string;
};

/** One homework this student has opened, handed in, or had marked. */
export type StudentSubmission = {
  id: string;
  homeworkId: string;
  /** Never empty — falls back to the slug when the homework has no title. */
  homeworkTitle: string;
  lessonTitle: string;
  module: string;
  status: SubmissionStatus;
  score: number | null;
  /** Empty while they're still working on it. */
  submittedAt: string;
  gradedAt: string | null;
  feedback: string;
};

/** A module they have been through, or are in now. */
export type StudentModuleEntry = {
  moduleId: string;
  module: string;
  status: "in_progress" | "completed";
  startedAt: string;
  completedAt: string | null;
};

/** A group they sit in. */
export type StudentGroup = {
  id: string;
  name: string;
  /** `Date.getDay()` numbering, 0 = Sunday. Empty for no fixed days. */
  meetsOn: number[];
  /** "HH:MM:SS", or null for no fixed hour — `formatTime` reads it. */
  startsAt: string | null;
  active: boolean;
};

/** One class they were marked in or out of. */
export type StudentClass = {
  id: string;
  /** The Postgres `date`, e.g. "2026-08-14". */
  classDate: string;
  present: boolean;
  groupName: string;
  /** What was taught that day, as snapshotted at the time. */
  lessonTitle: string;
};

/** Everything on one student, as the dashboard reads it. */
export type StudentDossier = {
  student: StudentProfile;
  /** Newest first. Includes homework only started — knowing who has opened one
   *  and gone quiet is worth as much as knowing who has finished. */
  submissions: StudentSubmission[];
  /** Newest first. */
  modules: StudentModuleEntry[];
  groups: StudentGroup[];
  /** Newest first. */
  classes: StudentClass[];
};

/** The figures across the top of the dashboard, derived rather than stored. */
export type StudentSummary = {
  /** Mean of every mark released, 0–10. Null before the first one. */
  averageScore: number | null;
  /** The most recent mark, for the trend against the average. */
  latestScore: number | null;
  gradedCount: number;
  /** Handed in and waiting on a teacher. */
  awaitingCount: number;
  /** Opened and not handed in. */
  startedCount: number;
  /** Everything they have touched, in any state. */
  totalSubmissions: number;
  /** Share of registers taken that were a yes, 0–1. Null before the first. */
  attendanceRate: number | null;
  classesAttended: number;
  classesRecorded: number;
  /** ISO timestamp of the last thing they did — handed in, or turned up. Empty
   *  when they have done neither. */
  lastActivity: string;
};

type ProfileRecord = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  current_module_id: string | null;
  teacher_id: string | null;
  notes: string | null;
  avatar_path: string | null;
  monthly_fee: number | string | null;
  classes_per_week: number | null;
  created_at: string | null;
  module: Embedded<{ name?: string | null }>;
  teacher: Embedded<{ full_name?: string | null; email?: string | null }>;
};

type LessonEmbed = { title: string | null; module: string | null };

type SubmissionRecord = {
  id: string;
  homework_id: string;
  status: string | null;
  score: number | string | null;
  submitted_at: string | null;
  graded_at: string | null;
  feedback: string | null;
  homework: Embedded<{
    title: string | null;
    lesson: Embedded<LessonEmbed>;
  }>;
};

type ModuleRecord = {
  module_id: string;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  module: Embedded<{ name?: string | null }>;
};

type MembershipRecord = {
  group_id: string;
  group: Embedded<{
    name: string | null;
    starts_at: string | null;
    meets_on: number[] | null;
    status: string | null;
  }>;
};

type ClassRecord = {
  id: string;
  class_date: string;
  present: boolean | null;
  group: Embedded<{ name?: string | null }>;
  lesson: Embedded<{ title?: string | null }>;
};

function toSubmissionStatus(raw: unknown): SubmissionStatus {
  return raw === "submitted" || raw === "graded" ? raw : "in_progress";
}

/**
 * One student, everything about them. Null when there is no such student *or*
 * when the caller isn't allowed to see them — the two are the same answer here,
 * and telling them apart would leak the existence of another teacher's roster.
 */
export async function fetchStudentDossier(
  studentId: string,
): Promise<StudentDossier | null> {
  const [profile, submissions, modules, memberships, classes] =
    await Promise.all([
      supabase
        .from("students")
        .select(
          "id, user_id, full_name, email, phone, status, current_module_id, teacher_id, notes, avatar_path, monthly_fee, classes_per_week, created_at, module:modules (name), teacher:profiles (full_name, email)",
        )
        .eq("id", studentId)
        .maybeSingle(),
      supabase
        .from("homework_submissions")
        .select(
          "id, homework_id, status, score, submitted_at, graded_at, feedback, homework:homework (title, lesson:lessons (title, module))",
        )
        .eq("student_id", studentId)
        // Work only started has no `submitted_at`; it sorts to the end rather
        // than the top, where it would push what's actually waiting out of view.
        .order("submitted_at", { ascending: false, nullsFirst: false }),
      supabase
        .from("student_modules")
        .select("module_id, status, started_at, completed_at, module:modules (name)")
        .eq("student_id", studentId)
        .order("started_at", { ascending: false }),
      supabase
        .from("group_students")
        .select("group_id, group:groups (name, starts_at, meets_on, status)")
        .eq("student_id", studentId),
      supabase
        .from("group_attendance")
        .select(
          "id, class_date, present, group:groups (name), lesson:lessons (title)",
        )
        .eq("student_id", studentId)
        .order("class_date", { ascending: false }),
    ]);

  if (profile.error) throw new Error(profile.error.message);
  if (!profile.data) return null;

  if (submissions.error) throw new Error(submissions.error.message);
  if (modules.error) throw new Error(modules.error.message);
  if (memberships.error) throw new Error(memberships.error.message);
  if (classes.error) throw new Error(classes.error.message);

  const record = profile.data as ProfileRecord;
  const teacher = one(record.teacher);

  return {
    student: {
      id: record.id,
      userId: record.user_id,
      name: record.full_name ?? "",
      email: record.email ?? "",
      phone: record.phone ?? "",
      status: record.status === "inactive" ? "inactive" : "active",
      moduleId: record.current_module_id,
      module: one(record.module)?.name ?? "",
      teacherId: record.teacher_id,
      // Falls back to the email so a teacher who never filled in a name is still
      // named here rather than showing as unassigned.
      teacher: teacher?.full_name || teacher?.email || "",
      notes: record.notes ?? "",
      avatarPath: record.avatar_path ?? "",
      monthlyFee: toNumber(record.monthly_fee),
      classesPerWeek: record.classes_per_week,
      createdAt: record.created_at ?? "",
    },

    submissions: ((submissions.data ?? []) as SubmissionRecord[]).map((row) => {
      const homework = one(row.homework);
      const lesson = one(homework?.lesson ?? null);

      return {
        id: row.id,
        homeworkId: row.homework_id,
        // `||`, not `??`: an untitled homework holds an empty string, not a
        // null, and a blank row identifies nothing.
        homeworkTitle: homework?.title || row.homework_id,
        lessonTitle: lesson?.title ?? "",
        module: lesson?.module ?? "",
        status: toSubmissionStatus(row.status),
        score: toNumber(row.score),
        submittedAt: row.submitted_at ?? "",
        gradedAt: row.graded_at,
        feedback: row.feedback ?? "",
      };
    }),

    modules: ((modules.data ?? []) as ModuleRecord[]).map((row) => ({
      moduleId: row.module_id,
      module: one(row.module)?.name ?? "",
      status: row.status === "completed" ? "completed" : "in_progress",
      startedAt: row.started_at ?? "",
      completedAt: row.completed_at,
    })),

    groups: ((memberships.data ?? []) as MembershipRecord[])
      .map((row) => {
        const group = one(row.group);
        return {
          id: row.group_id,
          name: group?.name ?? "",
          meetsOn: group?.meets_on ?? [],
          startsAt: group?.starts_at ?? null,
          active: group?.status !== "inactive",
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),

    classes: ((classes.data ?? []) as ClassRecord[]).map((row) => ({
      id: row.id,
      classDate: row.class_date,
      present: !!row.present,
      groupName: one(row.group)?.name ?? "",
      lessonTitle: one(row.lesson)?.title ?? "",
    })),
  };
}

/**
 * The dossier reduced to the numbers along the top.
 *
 * Averaged over marks actually released, not over everything handed in: an
 * unmarked homework is not a zero, and counting it as one would make a student
 * look worse the more work they do.
 */
export function summarise(dossier: StudentDossier): StudentSummary {
  const graded = dossier.submissions.filter(
    (submission) => submission.status === "graded" && submission.score !== null,
  );

  const total = graded.reduce(
    (running, submission) => running + (submission.score ?? 0),
    0,
  );

  const attended = dossier.classes.filter((session) => session.present).length;

  // `submissions` and `classes` are both newest first, so the latest of each is
  // the head of its list. A class date is a bare day, not a timestamp: read as
  // local midnight so it doesn't compare as the day before west of Greenwich.
  const lastHandIn = dossier.submissions.find((s) => s.submittedAt)?.submittedAt;
  const lastClass = dossier.classes[0]?.classDate;
  const lastActivity = [
    lastHandIn ? new Date(lastHandIn) : null,
    lastClass ? new Date(`${lastClass}T00:00:00`) : null,
  ]
    .filter((date): date is Date => date !== null && !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    averageScore: graded.length ? total / graded.length : null,
    // `graded` keeps the order of the list it came from — by hand-in date, newest
    // first — so its head is their most recent piece of marked work, not their
    // best one.
    latestScore: graded[0]?.score ?? null,
    gradedCount: graded.length,
    awaitingCount: dossier.submissions.filter((s) => s.status === "submitted")
      .length,
    startedCount: dossier.submissions.filter((s) => s.status === "in_progress")
      .length,
    totalSubmissions: dossier.submissions.length,
    attendanceRate: dossier.classes.length
      ? attended / dossier.classes.length
      : null,
    classesAttended: attended,
    classesRecorded: dossier.classes.length,
    lastActivity: lastActivity ? lastActivity.toISOString() : "",
  };
}

/** Saves the staff note on a student. Blank clears it rather than storing "". */
export async function setStudentNotes(
  studentId: string,
  notes: string,
): Promise<void> {
  const { error } = await supabase
    .from("students")
    .update({ notes: notes.trim() || null })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
}

/**
 * Flips one register entry between present and absent.
 *
 * Updates a row that already exists rather than upserting: `group_attendance`
 * carries the group and the lesson taught that day, and inventing a row from a
 * date alone would record a class nobody said happened. Adding a day is the
 * register's job, on the group's own screen; this is the correction.
 *
 * RLS does the rest — `owns_group()` (0007) means a teacher can only correct
 * the register of a group of theirs.
 */
export async function setClassAttendance(
  attendanceId: string,
  present: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("group_attendance")
    .update({ present })
    .eq("id", attendanceId);

  if (error) throw new Error(error.message);
}
