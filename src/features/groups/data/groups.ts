// Groups: students taught together, the lesson they're on, and who turned up.
//
// Schema and RLS in supabase/migrations/0007_groups_and_finances.sql. A group
// belongs to a teacher the same way a student does, so — as everywhere else on
// the school side — the same call returns a different list depending on who is
// asking, and there is no filtering to do here.
//
// The classes themselves — lesson, date, time, register — are in
// ./group-classes; this file only reads attendance for the group-wide tallies.

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

/**
 * A Postgres `time` as a clock reads it — "19:00".
 *
 * PostgREST hands back the full "19:00:00"; the seconds are noise on a
 * timetable, and trimming them here means no caller has to know they were ever
 * there. Null (no fixed hour) formats as "" so it drops out of a joined line.
 */
export function formatTime(startsAt: string | null): string {
  return startsAt ? startsAt.slice(0, 5) : "";
}

/** A group's schedule in one line: the days, then the time it starts. */
export function formatSchedule(group: {
  meetsOn: number[];
  startsAt: string | null;
}): string {
  return [formatDays(group.meetsOn), formatTime(group.startsAt)]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Groups in the order a day runs: earliest first, and the ones with no fixed
 * hour after everything that has one — an unscheduled class is not a 00:00 one.
 *
 * A plain string compare does the sorting, which is the whole point of the
 * column being a `time`: "09:00" < "19:00" as text exactly because the hour is
 * zero-padded and fixed-width.
 */
export function byStartTime(a: { startsAt: string | null }, b: { startsAt: string | null }): number {
  if (a.startsAt === b.startsAt) return 0;
  if (!a.startsAt) return 1;
  if (!b.startsAt) return -1;
  return a.startsAt < b.startsAt ? -1 : 1;
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
  /** The time class starts, "HH:MM:SS" as Postgres stores it, or null for a
   *  group with no fixed hour. Format it with {@link formatTime}. */
  startsAt: string | null;
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

/** One student on a group's roster. Their attendance is worked out from the
 *  group's classes — see `attendanceByStudent` in ./group-classes. */
export type GroupMember = {
  studentId: string;
  name: string;
  email: string;
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
  starts_at: string | null;
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
  "id, name, teacher_id, current_lesson_id, meets_on, starts_at, status, context, module_id, teacher:profiles (full_name, email), lesson:lessons (title, module), module:modules (name)";

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
    startsAt: record.starts_at,
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

/** Who is in the group, by name, for the register. */
export async function listGroupMembers(
  groupId: string,
): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from("group_students")
    .select("student_id, student:students (full_name, email)")
    .eq("group_id", groupId);

  if (error) throw new Error(error.message);

  return ((data ?? []) as MemberRecord[])
    .map((record) => {
      const student = one(record.student);
      return {
        studentId: record.student_id,
        name: student?.full_name ?? "",
        email: student?.email ?? "",
      };
    })
    .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
}

/** Just the ids of who is in the group — for callers that only need to know
 *  whether somebody is on the roster. */
export async function listGroupStudentIds(
  groupId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("group_students")
    .select("student_id")
    .eq("group_id", groupId);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.student_id as string);
}

/**
 * A query against a column or table from a migration that hasn't been run yet.
 * The page should go on working the way it did before rather than fall over —
 * the register predates 0025 and is still useful without it.
 */
export function isMissingSchema(error: { code?: string } | null): boolean {
  return ["42703", "42P01", "PGRST204", "PGRST205"].includes(error?.code ?? "");
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

export type NewGroup = {
  name: string;
  /** Who teaches it. Required in practice — the write policy only accepts the
   *  caller themselves unless they're the admin. */
  teacherId: string;
  /** Days of the week, `Date.getDay()` numbering. Empty is allowed. */
  meetsOn?: number[];
  /** "HH:MM" as the time input produces it. Omitted for no fixed hour. */
  startsAt?: string | null;
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
      starts_at: input.startsAt || null,
      current_lesson_id: input.lessonId || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Changes the time class starts. "" (the empty time input) clears it. */
export async function setGroupTime(
  groupId: string,
  startsAt: string,
): Promise<void> {
  const { error } = await supabase
    .from("groups")
    .update({ starts_at: startsAt || null })
    .eq("id", groupId);

  if (error) throw new Error(error.message);
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
