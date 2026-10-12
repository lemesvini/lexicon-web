// The classes a group has had: what was taught, when, and who was there.
//
// Schema, RLS and `save_group_class` in
// supabase/migrations/0028_group_classes.sql. A class is one row of
// `group_classes`; its register is the `group_attendance` rows hanging off it,
// one per student marked. A student with no row was not marked — which is not
// the same as absent, and is why a mark has three values plus "none".
//
// A class is always saved whole — lesson, date, time and the complete register
// in one transaction — so there is never a class on record with half its marks,
// or a mark filed under a lesson the class wasn't for.

import { supabase } from "@/lib/supabase";

/** One student's mark in one class. Absent from a register = not marked. */
export type Mark = "present" | "absent" | "excused";

export type ClassMark = {
  studentId: string;
  /** Name, or email, or "" — for students since removed from the group, whom
   *  the roster no longer names. */
  name: string;
  mark: Mark;
};

export type GroupClass = {
  id: string;
  groupId: string;
  lessonId: string | null;
  /** "" when no lesson was set, or it has since been deleted. */
  lessonTitle: string;
  /** Postgres `date`, e.g. "2026-08-14". */
  classDate: string;
  /** "HH:MM:SS" as Postgres stores it, or null for no recorded time. */
  startsAt: string | null;
  marks: ClassMark[];
  present: number;
  /** Students marked either way, excused included. */
  total: number;
};

type Embedded<T> = T | T[] | null;

function one<T>(embedded: Embedded<T>): T | undefined {
  return Array.isArray(embedded) ? embedded[0] : (embedded ?? undefined);
}

type ClassRecord = {
  id: string;
  group_id: string;
  lesson_id: string | null;
  class_date: string;
  starts_at: string | null;
  lesson: Embedded<{ title?: string | null }>;
  attendance: {
    student_id: string;
    present: boolean | null;
    excused: boolean | null;
    student: Embedded<{ full_name?: string | null; email?: string | null }>;
  }[] | null;
};

const CLASS_SELECT =
  "id, group_id, lesson_id, class_date, starts_at, lesson:lessons (title), attendance:group_attendance (student_id, present, excused, student:students (full_name, email))";

function toMark(present: boolean | null, excused: boolean | null): Mark {
  return present ? "present" : excused ? "excused" : "absent";
}

function toGroupClass(record: ClassRecord): GroupClass {
  const marks = (record.attendance ?? []).map((row) => {
    const student = one(row.student);
    return {
      studentId: row.student_id,
      name: student?.full_name || student?.email || "",
      mark: toMark(row.present, row.excused),
    };
  });

  return {
    id: record.id,
    groupId: record.group_id,
    lessonId: record.lesson_id,
    lessonTitle: one(record.lesson)?.title ?? "",
    classDate: record.class_date,
    startsAt: record.starts_at,
    marks,
    present: marks.filter((entry) => entry.mark === "present").length,
    total: marks.length,
  };
}

/** Every class this group has had, newest first — by date, then by time. */
export async function listGroupClasses(groupId: string): Promise<GroupClass[]> {
  const { data, error } = await supabase
    .from("group_classes")
    .select(CLASS_SELECT)
    .eq("group_id", groupId)
    .order("class_date", { ascending: false })
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ClassRecord[]).map(toGroupClass);
}

/**
 * Saves a class whole: creates it (no `classId`) or rewrites it, with the
 * complete register. A student left out of `marks` ends up not marked for this
 * class, whatever they had before. Returns the class's id.
 */
export async function saveGroupClass(input: {
  classId: string | null;
  groupId: string;
  lessonId: string | null;
  classDate: string;
  /** "HH:MM" as the time input produces it; "" for no time. */
  startsAt: string;
  marks: { studentId: string; mark: Mark }[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("save_group_class", {
    p_class_id: input.classId,
    p_group_id: input.groupId,
    p_lesson_id: input.lessonId,
    p_class_date: input.classDate,
    p_starts_at: input.startsAt || null,
    p_marks: input.marks.map((entry) => ({
      student_id: entry.studentId,
      present: entry.mark === "present",
      excused: entry.mark === "excused",
    })),
  });

  if (error) {
    // PGRST202: the function isn't there — the migration hasn't been run.
    if (error.code === "PGRST202") {
      throw new Error(
        "Run migration 0028_group_classes.sql to record classes.",
      );
    }
    throw new Error(error.message);
  }
  return data as string;
}

/** Deletes a class and its register. The plan works out what is next again
 *  from the classes that are left. */
export async function deleteGroupClass(classId: string): Promise<void> {
  const { error } = await supabase
    .from("group_classes")
    .delete()
    .eq("id", classId);
  if (error) throw new Error(error.message);
}

/**
 * The lesson to suggest for the next class: the one after the lesson of the
 * most recent class at least one student was present at.
 *
 * Only classes whose lesson is in `sequence` are looked at — a class spent on
 * something outside the group's course says nothing about where in it they are.
 * Before any such class, the first lesson. After the last lesson, null: the
 * course is done, and there is nothing honest to suggest.
 *
 * `classes` must be newest first, as {@link listGroupClasses} returns them.
 */
export function suggestNextLesson(
  sequence: readonly string[],
  classes: readonly GroupClass[],
): string | null {
  const last = lastHeldClass(sequence, classes);
  if (!last?.lessonId) return sequence[0] ?? null;
  return sequence[sequence.indexOf(last.lessonId) + 1] ?? null;
}

/** The most recent class with somebody present, whose lesson is in
 *  `sequence` — the one {@link suggestNextLesson} counts on from. */
export function lastHeldClass(
  sequence: readonly string[],
  classes: readonly GroupClass[],
): GroupClass | null {
  const inSequence = new Set(sequence);
  return (
    classes.find(
      (entry) =>
        entry.present > 0 && !!entry.lessonId && inSequence.has(entry.lessonId),
    ) ?? null
  );
}

/** A student's attendance across every class: present out of marked, excused
 *  absences left out — they are recorded, not held against the student. */
export type AttendanceTally = { present: number; total: number };

export function attendanceByStudent(
  classes: readonly GroupClass[],
): Map<string, AttendanceTally> {
  const tallies = new Map<string, AttendanceTally>();
  for (const entry of classes) {
    for (const { studentId, mark } of entry.marks) {
      if (mark === "excused") continue;
      const tally = tallies.get(studentId) ?? { present: 0, total: 0 };
      tally.total += 1;
      if (mark === "present") tally.present += 1;
      tallies.set(studentId, tally);
    }
  }
  return tallies;
}

/** A lesson a student was away for, and hasn't been to since. */
export type MissedLesson = {
  classDate: string;
  lessonId: string;
  title: string;
  excused: boolean;
};

/**
 * What each student has to catch up on: lessons taught in a class they were
 * marked absent from, which no class since has had them present for.
 *
 * Only a class that happened counts — somebody present — and only an explicit
 * absence: a student who joined last week wasn't absent from the classes before.
 */
export function missedLessons(
  classes: readonly GroupClass[],
): Map<string, MissedLesson[]> {
  const attended = new Set<string>();
  for (const entry of classes) {
    if (!entry.lessonId) continue;
    for (const { studentId, mark } of entry.marks) {
      if (mark === "present") attended.add(`${studentId}:${entry.lessonId}`);
    }
  }

  const missed = new Map<string, MissedLesson[]>();
  // Oldest first, so each student's list reads in the order it happened.
  for (const entry of [...classes].reverse()) {
    const lessonId = entry.lessonId;
    if (!lessonId || entry.present === 0) continue;
    for (const { studentId, mark } of entry.marks) {
      if (mark === "present") continue;
      if (attended.has(`${studentId}:${lessonId}`)) continue;
      const list = missed.get(studentId) ?? [];
      if (list.some((item) => item.lessonId === lessonId)) continue;
      list.push({
        classDate: entry.classDate,
        lessonId,
        title: entry.lessonTitle,
        excused: mark === "excused",
      });
      missed.set(studentId, list);
    }
  }
  return missed;
}

/** A register that has been taken: the class happened. */
export type TakenRegister = {
  groupId: string;
  /** How many of the marked students turned up, across the day's classes. */
  present: number;
  /** How many were marked either way. */
  total: number;
};

/**
 * Which groups already have a class recorded on each of the given dates — the
 * dashboard's "and which of it have I already taught?". Every requested date
 * gets an entry so the caller can tell "nothing taken" from "not asked for". A
 * group with two classes on one day has them summed.
 */
export async function listRegistersTakenOn(
  dateKeys: readonly string[],
): Promise<Map<string, Map<string, TakenRegister>>> {
  const byDate = new Map<string, Map<string, TakenRegister>>();
  for (const key of dateKeys) byDate.set(key, new Map());
  if (dateKeys.length === 0) return byDate;

  const { data, error } = await supabase
    .from("group_classes")
    .select("group_id, class_date, attendance:group_attendance (present)")
    .in("class_date", dateKeys as string[]);

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as unknown as {
    group_id: string;
    class_date: string;
    attendance: { present: boolean | null }[] | null;
  }[]) {
    const forDay = byDate.get(row.class_date);
    if (!forDay) continue;
    const tally = forDay.get(row.group_id) ?? {
      groupId: row.group_id,
      present: 0,
      total: 0,
    };
    for (const mark of row.attendance ?? []) {
      tally.total += 1;
      if (mark.present) tally.present += 1;
    }
    forDay.set(row.group_id, tally);
  }

  return byDate;
}
