// Groups: students taught together, the lesson they're on, and who turned up.
//
// Schema and RLS in supabase/migrations/0007_groups_and_finances.sql. A group
// belongs to a teacher the same way a student does, so — as everywhere else on
// the school side — the same call returns a different list depending on who is
// asking, and there is no filtering to do here.
//
// Attendance is one row per student per class date, upserted on that triple. So
// ticking a box twice is the same as ticking it once, and re-opening an old date
// shows what was recorded rather than a blank register.

import { supabase } from "@/lib/supabase";

export type GroupStatus = "active" | "inactive";

/**
 * The days a group can meet on, indexed the way `Date.getDay()` numbers them —
 * 0 is Sunday. Stored as those numbers rather than names so "is this group on
 * today?" is a comparison, not a parse.
 *
 * Monday first in this list because that is how a timetable reads; the `day`
 * value, not the position, is what goes to the database.
 */
export const WEEKDAYS = [
  { day: 1, short: "Mon", long: "Monday" },
  { day: 2, short: "Tue", long: "Tuesday" },
  { day: 3, short: "Wed", long: "Wednesday" },
  { day: 4, short: "Thu", long: "Thursday" },
  { day: 5, short: "Fri", long: "Friday" },
  { day: 6, short: "Sat", long: "Saturday" },
  { day: 0, short: "Sun", long: "Sunday" },
] as const;

/** Days as a timetable writes them — "Mon, Wed", always in week order. */
export function formatDays(days: readonly number[]): string {
  return WEEKDAYS.filter((weekday) => days.includes(weekday.day))
    .map((weekday) => weekday.short)
    .join(", ");
}

/** A group's schedule in one line: the days, then whatever `schedule` adds. */
export function formatSchedule(group: {
  meetsOn: number[];
  schedule: string;
}): string {
  return [formatDays(group.meetsOn), group.schedule]
    .filter(Boolean)
    .join(" · ");
}

/** A group as it appears in the left-hand list. */
export type GroupRow = {
  id: string;
  name: string;
  teacherId: string | null;
  /** Teacher name, or "—". */
  teacher: string;
  /** Days of the week it meets, `Date.getDay()` numbering. Empty for a group
   *  with no fixed schedule. */
  meetsOn: number[];
  /** Free text alongside the days — normally the time. Empty when unset. */
  schedule: string;
  status: GroupStatus;
  lessonId: string | null;
  /** The lesson's title, or "" when there is no lesson set. */
  lessonTitle: string;
  /** The module that lesson belongs to, for the subtitle. */
  lessonModule: string;
  /** Free-text description of the class — who they are, what keeps going wrong.
   *  The group-level counterpart of `students.notes`, and one of the three
   *  things the advanced-context suggestions are built from. */
  context: string;
  /** The module the group is working through, or null. Not the source of truth
   *  for what they have — `group_lessons` is — just the last choice made in the
   *  group's studio. */
  moduleId: string | null;
  /** That module's name, or "" when none is set. */
  moduleName: string;
  memberCount: number;
  /** Share of all attendance ever recorded that was a yes, 0–1. Null when the
   *  register has never been taken. */
  attendanceRate: number | null;
};

/** One student on a group's register. */
export type GroupMember = {
  studentId: string;
  name: string;
  email: string;
  /** Whether they were marked in or out on the date being viewed. Null when the
   *  register wasn't taken for them that day — which is not the same as absent,
   *  and is why the checkbox starts empty rather than unticked. */
  present: boolean | null;
  /** Their own share across every date, 0–1, or null before any is recorded. */
  attendanceRate: number | null;
  /** How many classes that rate is out of. */
  sessions: number;
};

const NO_TEACHER = "—";

type Embedded<T> = T | T[] | null;

/** PostgREST returns an embedded to-one either as an object or as a
 *  one-element array, depending on how it resolves the relationship. */
function one<T>(embedded: Embedded<T>): T | undefined {
  return Array.isArray(embedded) ? embedded[0] : (embedded ?? undefined);
}

type GroupRecord = {
  id: string;
  name: string | null;
  teacher_id: string | null;
  current_lesson_id: string | null;
  meets_on: number[] | null;
  schedule: string | null;
  status: string | null;
  context: string | null;
  module_id: string | null;
  teacher: Embedded<{ full_name?: string | null; email?: string | null }>;
  lesson: Embedded<{ title?: string | null; module?: string | null }>;
  module: Embedded<{ name?: string | null }>;
};

/** The columns every group read selects. Spelled once so the row mapper and the
 *  record type can't drift from what the two callers actually ask for. */
const GROUP_SELECT =
  "id, name, teacher_id, current_lesson_id, meets_on, schedule, status, context, module_id, teacher:profiles (full_name, email), lesson:lessons (title, module), module:modules (name)";

function toGroupRow(
  record: GroupRecord,
  memberCount: number,
  tally: { present: number; total: number } | undefined,
): GroupRow {
  const teacher = one(record.teacher);
  const lesson = one(record.lesson);

  return {
    id: record.id,
    name: record.name ?? "",
    teacherId: record.teacher_id,
    teacher: teacher?.full_name || teacher?.email || NO_TEACHER,
    meetsOn: record.meets_on ?? [],
    schedule: record.schedule ?? "",
    status: record.status === "inactive" ? "inactive" : "active",
    lessonId: record.current_lesson_id,
    lessonTitle: lesson?.title ?? "",
    lessonModule: lesson?.module ?? "",
    context: record.context ?? "",
    moduleId: record.module_id,
    moduleName: one(record.module)?.name ?? "",
    memberCount,
    attendanceRate: tally?.total ? tally.present / tally.total : null,
  };
}

/** A date as Postgres wants it, in the *browser's* timezone — `toISOString()`
 *  would roll over to tomorrow for anyone east of UTC teaching in the evening. */
export function toDateKey(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Today, as the register's default date. */
export function today(): string {
  return toDateKey(new Date());
}

/**
 * The inverse of {@link toDateKey}: a Postgres `date` read back as a local
 * calendar day.
 *
 * `new Date("2026-08-14")` is not this — a bare date string is parsed as UTC
 * midnight, which formats as the 13th anywhere west of Greenwich, here very much
 * included. Building it from the parts keeps the day the one that was typed.
 */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/**
 * Every group the caller can see, with its size and overall attendance.
 *
 * The counts and rates come from separate queries rather than embedded
 * aggregates: PostgREST can only count through a relationship in one direction,
 * and both of these need the other one. Three round trips in parallel is cheaper
 * than the view it would otherwise take.
 */
export async function listGroups(): Promise<GroupRow[]> {
  const [groups, members, attendance] = await Promise.all([
    supabase
      .from("groups")
      .select(GROUP_SELECT)
      .order("name", { ascending: true }),
    supabase.from("group_students").select("group_id"),
    supabase.from("group_attendance").select("group_id, present"),
  ]);

  if (groups.error) throw new Error(groups.error.message);
  if (members.error) throw new Error(members.error.message);
  if (attendance.error) throw new Error(attendance.error.message);

  const counts = new Map<string, number>();
  for (const row of members.data ?? []) {
    const id = row.group_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const tallies = new Map<string, { present: number; total: number }>();
  for (const row of attendance.data ?? []) {
    const id = row.group_id as string;
    const tally = tallies.get(id) ?? { present: 0, total: 0 };
    tally.total += 1;
    if (row.present) tally.present += 1;
    tallies.set(id, tally);
  }

  return ((groups.data ?? []) as unknown as GroupRecord[]).map((record) =>
    toGroupRow(record, counts.get(record.id) ?? 0, tallies.get(record.id)),
  );
}

/**
 * One group, for the page that is only about that group.
 *
 * Separate from `listGroups()` on purpose: opening `/groups/:id` shouldn't read
 * every group in the school, and — more to the point — a page that can be linked
 * to directly must not depend on the row happening to be in a list somewhere.
 * Returns null when the id doesn't resolve, which for RLS includes "exists, but
 * not yours".
 */
export async function fetchGroup(groupId: string): Promise<GroupRow | null> {
  const [group, members, attendance] = await Promise.all([
    supabase.from("groups").select(GROUP_SELECT).eq("id", groupId).maybeSingle(),
    supabase.from("group_students").select("student_id").eq("group_id", groupId),
    supabase.from("group_attendance").select("present").eq("group_id", groupId),
  ]);

  if (group.error) throw new Error(group.error.message);
  if (members.error) throw new Error(members.error.message);
  if (attendance.error) throw new Error(attendance.error.message);
  if (!group.data) return null;

  const rows = attendance.data ?? [];
  const tally = {
    present: rows.filter((row) => row.present).length,
    total: rows.length,
  };

  return toGroupRow(
    group.data as unknown as GroupRecord,
    members.data?.length ?? 0,
    tally,
  );
}

type MemberRecord = {
  student_id: string;
  student: Embedded<{ full_name?: string | null; email?: string | null }>;
};

/**
 * The register for one group on one date: who is in it, whether they were marked
 * in that day, and how they've done overall.
 *
 * The whole group's attendance history is fetched, not just the day's — the
 * per-student rate is the column that makes the register worth reading, and it
 * is a small table.
 */
export async function listGroupMembers(
  groupId: string,
  classDate: string,
): Promise<GroupMember[]> {
  const [members, attendance] = await Promise.all([
    supabase
      .from("group_students")
      .select("student_id, student:students (full_name, email)")
      .eq("group_id", groupId),
    supabase
      .from("group_attendance")
      .select("student_id, class_date, present")
      .eq("group_id", groupId),
  ]);

  if (members.error) throw new Error(members.error.message);
  if (attendance.error) throw new Error(attendance.error.message);

  const onTheDay = new Map<string, boolean>();
  const tallies = new Map<string, { present: number; total: number }>();

  for (const row of attendance.data ?? []) {
    const studentId = row.student_id as string;
    if (row.class_date === classDate) onTheDay.set(studentId, !!row.present);

    const tally = tallies.get(studentId) ?? { present: 0, total: 0 };
    tally.total += 1;
    if (row.present) tally.present += 1;
    tallies.set(studentId, tally);
  }

  return ((members.data ?? []) as MemberRecord[])
    .map((record) => {
      const student = one(record.student);
      const tally = tallies.get(record.student_id);

      return {
        studentId: record.student_id,
        name: student?.full_name ?? "",
        email: student?.email ?? "",
        present: onTheDay.get(record.student_id) ?? null,
        attendanceRate: tally?.total ? tally.present / tally.total : null,
        sessions: tally?.total ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One student in the group, with the note the teacher keeps on them. */
export type GroupStudentContext = {
  studentId: string;
  name: string;
  /** `students.notes` — the student-level twin of `groups.context`, and the
   *  second of the three things the block suggestions are built from. Empty
   *  when nothing has been written. */
  notes: string;
};

/**
 * The group's students and their notes, for the context panel.
 *
 * Separate from `listGroupMembers` rather than a column added to it: that one is
 * the register's list and is fetched per class date with a second query behind
 * it, and asking for it to answer "who has no notes yet" would drag attendance
 * arithmetic into a question that has nothing to do with attendance.
 */
export async function listGroupContexts(
  groupId: string,
): Promise<GroupStudentContext[]> {
  const { data, error } = await supabase
    .from("group_students")
    .select("student_id, student:students (full_name, notes)")
    .eq("group_id", groupId);

  if (error) throw new Error(error.message);

  return (
    (data ?? []) as unknown as {
      student_id: string;
      student: Embedded<{ full_name?: string | null; notes?: string | null }>;
    }[]
  )
    .map((record) => {
      const student = one(record.student);
      return {
        studentId: record.student_id,
        name: student?.full_name ?? "",
        notes: student?.notes ?? "",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One class the group has a register for, as the attendance panel lists it. */
export type AttendanceDay = {
  /** The Postgres `date`, e.g. "2026-08-14". Also the key the register opens on. */
  classDate: string;
  /** What was taught, as recorded at the time. "" when the group had no lesson
   *  set that day, or the lesson has since been deleted. */
  lessonTitle: string;
  present: number;
  /** How many students were marked either way — the register as it was taken,
   *  not the group as it stands now. Someone since removed still counts here. */
  total: number;
};

type AttendanceRecord = {
  class_date: string;
  present: boolean | null;
  lesson: Embedded<{ title?: string | null }>;
};

/**
 * Every class this group has a register for, newest first.
 *
 * Rolled up by date here rather than in SQL: PostgREST exposes no GROUP BY, and
 * a group's history is tens of rows, not thousands. The lesson comes from the
 * first row of each day — every row of one class is written with the same
 * `lesson_id`, and on the rare day it changed mid-class the earlier one is the
 * honest answer.
 */
export async function listGroupAttendance(
  groupId: string,
): Promise<AttendanceDay[]> {
  const { data, error } = await supabase
    .from("group_attendance")
    .select("class_date, present, lesson:lessons (title)")
    .eq("group_id", groupId)
    .order("class_date", { ascending: false });

  if (error) throw new Error(error.message);

  // Insertion order follows the query's ordering, so the Map comes out newest
  // first without a second sort.
  const days = new Map<string, AttendanceDay>();

  for (const row of (data ?? []) as AttendanceRecord[]) {
    const day = days.get(row.class_date) ?? {
      classDate: row.class_date,
      lessonTitle: one(row.lesson)?.title ?? "",
      present: 0,
      total: 0,
    };
    day.total += 1;
    if (row.present) day.present += 1;
    days.set(row.class_date, day);
  }

  return [...days.values()];
}

export type NewGroup = {
  name: string;
  /** Who teaches it. Required in practice — the write policy only accepts the
   *  caller themselves unless they're the admin. */
  teacherId: string;
  /** Days of the week, `Date.getDay()` numbering. Empty is allowed. */
  meetsOn?: number[];
  schedule?: string;
  lessonId?: string | null;
};

/** Sorted and de-duplicated, so the column holds one canonical form however the
 *  picker happened to be clicked. The check constraint in 0008 covers the range. */
function cleanDays(days: readonly number[] | undefined): number[] {
  return [...new Set(days ?? [])]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);
}

export async function createGroup(input: NewGroup): Promise<string> {
  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: input.name.trim(),
      teacher_id: input.teacherId,
      meets_on: cleanDays(input.meetsOn),
      schedule: input.schedule?.trim() || null,
      current_lesson_id: input.lessonId || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Changes the days a group meets on. */
export async function setGroupDays(
  groupId: string,
  days: readonly number[],
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ meets_on: cleanDays(days) })
    .eq("id", groupId);

  if (error) throw new Error(error.message);
}

/**
 * The groups meeting on each of the given weekdays, keyed by day — what the
 * dashboard offers up as today's and tomorrow's classes.
 *
 * Takes the days together rather than one call each: every answer comes out of
 * the same group list, so asking twice would be two round trips to re-read rows
 * already in hand.
 *
 * Filtered here rather than in the query for the same reason — `listGroups()`
 * already carries the lesson title and the member count the dashboard shows.
 * Archived groups are left out: a schedule they're no longer taught on is not a
 * recommendation. Every requested day gets an entry, empty ones included, so the
 * caller can tell "nothing on" from "not asked for".
 */
export async function listClassesOnDays(
  weekdays: readonly number[],
): Promise<Map<number, GroupRow[]>> {
  const groups = await listGroups();
  const byDay = new Map<number, GroupRow[]>();

  for (const weekday of weekdays) {
    byDay.set(
      weekday,
      groups.filter(
        (group) => group.status === "active" && group.meetsOn.includes(weekday),
      ),
    );
  }

  return byDay;
}

/** Moves the group on to another lesson. Past attendance keeps the lesson it was
 *  recorded against, which is the point of snapshotting it there. */
export async function setGroupLesson(
  groupId: string,
  lessonId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ current_lesson_id: lessonId })
    .eq("id", groupId);

  if (error) throw new Error(error.message);
}

/** The class's own context — free text, saved explicitly, never autosaved. It
 *  feeds the advanced-context suggestions, so an empty one is worth noticing. */
export async function setGroupContext(
  groupId: string,
  context: string,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ context: context.trim() || null })
    .eq("id", groupId);

  if (error) throw new Error(error.message);
}

/** Records which module the group is working through. Copying that module's
 *  lessons is a separate step (`addGroupLessons`) — this only moves the pointer,
 *  and never removes a copy the group already has. */
export async function setGroupModule(
  groupId: string,
  moduleId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ module_id: moduleId })
    .eq("id", groupId);

  if (error) throw new Error(error.message);
}

export async function setGroupStatus(
  groupId: string,
  status: GroupStatus,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ status })
    .eq("id", groupId);

  if (error) throw new Error(error.message);
}

/** Deliberately a real delete, unlike deactivating a teacher: a group is a
 *  timetable entry, not a person, and its attendance cascades with it. */
export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message);
}

export async function addGroupStudent(
  groupId: string,
  studentId: string,
): Promise<void> {
  const { error } = await supabase
    .from("group_students")
    .upsert(
      { group_id: groupId, student_id: studentId },
      { onConflict: "group_id,student_id" },
    );

  if (error) throw new Error(error.message);
}

/** Takes a student off the register. Their attendance rows stay: they really did
 *  attend those classes, and the group's history shouldn't rewrite itself. */
export async function removeGroupStudent(
  groupId: string,
  studentId: string,
): Promise<void> {
  const { error } = await supabase
    .from("group_students")
    .delete()
    .eq("group_id", groupId)
    .eq("student_id", studentId);

  if (error) throw new Error(error.message);
}

/**
 * Marks one student in or out for one class date. Upserted on the unique triple
 * from 0007, so changing your mind updates the record rather than adding a
 * second one for the same day.
 */
export async function setAttendance(input: {
  groupId: string;
  studentId: string;
  classDate: string;
  present: boolean;
  /** What was taught. Snapshotted so the record survives the group moving on. */
  lessonId: string | null;
}): Promise<void> {
  const { error } = await supabase.from("group_attendance").upsert(
    {
      group_id: input.groupId,
      student_id: input.studentId,
      class_date: input.classDate,
      present: input.present,
      lesson_id: input.lessonId,
    },
    { onConflict: "group_id,student_id,class_date" },
  );

  if (error) throw new Error(error.message);
}
