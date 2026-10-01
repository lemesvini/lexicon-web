// What a group has been taught, what comes next, and when the rest is expected.
//
// The register is the source of truth and the plan's dates follow it — see the
// header of supabase/migrations/0025_flexible_class_plan.sql for the whole model.
// In short:
//
//   * the plan is a sequence (`group_lessons.position`);
//   * a lesson is taught on the first day a register records it with somebody
//     present — a class nobody came to taught nothing, and needs no undoing;
//   * the next lesson is the first one in the sequence not yet taught;
//   * `scheduled_on` is a projection, rewritten by `reflowPlan` after every
//     register write: taught lessons carry the day they were taught, the rest
//     are laid on the coming meeting days, skipping cancelled ones.
//
// Nothing here is a one-off operation on the dates. Every write recomputes them
// from the register, so a mistake in the dates is fixed by fixing the register,
// and pressing something twice can't push the plan twice.

import { supabase } from "@/lib/supabase";

import {
  listGroupLessons,
  setGroupLessonDate,
  type GroupLessonRow,
} from "./group-lessons";
import {
  fromDateKey,
  isMissingSchema,
  listRegisterMarks,
  toDateKey,
  type RegisterMark,
} from "./groups";

/** How far back an unrecorded meeting day is still worth asking about. Older
 *  than this and it is history nobody is going to reconstruct. */
const PENDING_WINDOW_DAYS = 60;

/** The meeting days this group has marked as "no class". Empty before 0025. */
export async function listCancelledClasses(
  groupId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("group_cancelled_classes")
    .select("class_date")
    .eq("group_id", groupId);

  if (isMissingSchema(error)) return new Set();
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.class_date as string));
}

/** Marks a day as having no class, or takes that back. */
export async function setClassCancelled(
  groupId: string,
  classDate: string,
  cancelled: boolean,
): Promise<void> {
  const { error } = cancelled
    ? await supabase
        .from("group_cancelled_classes")
        .upsert(
          { group_id: groupId, class_date: classDate },
          { onConflict: "group_id,class_date" },
        )
    : await supabase
        .from("group_cancelled_classes")
        .delete()
        .eq("group_id", groupId)
        .eq("class_date", classDate);

  if (isMissingSchema(error)) {
    throw new Error(
      "Run migration 0025_flexible_class_plan.sql to mark days with no class.",
    );
  }
  if (error) throw new Error(error.message);
}

/** Re-files one day's register under a different lesson — for "that day we
 *  actually did lesson 6". Every mark of the day moves together. */
export async function setClassLesson(
  groupId: string,
  classDate: string,
  lessonId: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("group_attendance")
    .update({ lesson_id: lessonId })
    .eq("group_id", groupId)
    .eq("class_date", classDate);

  if (error) throw new Error(error.message);
}

export type ClassPlan = {
  /** The group's copies, in teaching order. */
  lessons: GroupLessonRow[];
  /** lessonId → the first day it was taught. */
  taughtOn: Map<string, string>;
  /** classDate → the lesson its register was taken for. */
  recordedLesson: Map<string, string | null>;
  /** Days with any mark at all. */
  recordedDays: Set<string>;
  /** Days somebody was present on — the classes that happened. */
  heldDays: Set<string>;
  cancelled: Set<string>;
  /** The first lesson in the sequence nobody has been taught yet. */
  next: GroupLessonRow | null;
  /** Past meeting days with no register and no "no class", oldest first. */
  pending: string[];
  marks: RegisterMark[];
};

function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** The plan as the register describes it. Pure, so it can be reasoned about
 *  (and recomputed) without a round trip. */
export function buildPlan(
  lessons: GroupLessonRow[],
  marks: RegisterMark[],
  cancelled: Set<string>,
  meetsOn: readonly number[],
  todayKey: string,
): ClassPlan {
  const ordered = [...lessons].sort((a, b) => a.position - b.position);

  const recordedLesson = new Map<string, string | null>();
  const recordedDays = new Set<string>();
  const heldDays = new Set<string>();
  const taughtOn = new Map<string, string>();

  // Marks arrive oldest first, so the first day a lesson is seen held is the
  // day it was taught.
  for (const mark of marks) {
    recordedDays.add(mark.classDate);
    if (!recordedLesson.has(mark.classDate) || mark.lessonId) {
      recordedLesson.set(
        mark.classDate,
        mark.lessonId ?? recordedLesson.get(mark.classDate) ?? null,
      );
    }
    if (mark.present) {
      heldDays.add(mark.classDate);
      if (mark.lessonId && !taughtOn.has(mark.lessonId)) {
        taughtOn.set(mark.lessonId, mark.classDate);
      }
    }
  }

  const next = ordered.find((row) => !taughtOn.has(row.lessonId)) ?? null;

  // A meeting day the register says nothing about. Only from the first
  // register on — before it the group hadn't started — and only recently.
  const pending: string[] = [];
  const first = [...recordedDays].sort()[0];
  if (first && meetsOn.length > 0) {
    const windowStart = addDays(todayKey, -PENDING_WINDOW_DAYS);
    let cursor = first > windowStart ? first : windowStart;
    while (cursor < todayKey) {
      if (
        meetsOn.includes(fromDateKey(cursor).getDay()) &&
        !recordedDays.has(cursor) &&
        !cancelled.has(cursor)
      ) {
        pending.push(cursor);
      }
      cursor = addDays(cursor, 1);
    }
  }

  return {
    lessons: ordered,
    taughtOn,
    recordedLesson,
    recordedDays,
    heldDays,
    cancelled,
    next,
    pending,
    marks,
  };
}

export async function loadClassPlan(
  groupId: string,
  meetsOn: readonly number[],
  todayKey: string,
): Promise<ClassPlan> {
  const [lessons, marks, cancelled] = await Promise.all([
    listGroupLessons(groupId),
    listRegisterMarks(groupId),
    listCancelledClasses(groupId),
  ]);
  return buildPlan(lessons, marks, cancelled, meetsOn, todayKey);
}

/**
 * Which lesson a register on `classDate` is for.
 *
 * What was recorded wins — that is history. A day with no register yet, up to
 * today, is for the next lesson: whatever the dates used to say, the class
 * that happens (or happened and wasn't written down) teaches what comes next.
 * Later days read the projection.
 */
export function lessonForDay(
  plan: ClassPlan,
  classDate: string,
  todayKey: string,
): GroupLessonRow | null {
  const recorded = plan.recordedLesson.get(classDate);
  if (recorded) {
    return plan.lessons.find((row) => row.lessonId === recorded) ?? null;
  }
  if (classDate <= todayKey) return plan.next;
  return plan.lessons.find((row) => row.scheduledOn === classDate) ?? null;
}

/**
 * The dates every copy should carry, given the register.
 *
 * Taught lessons keep the day they were taught. The rest go, in order, onto the
 * meeting days from today on — skipping any day already recorded (a class
 * nobody came to still used up that day) or marked as no class, and never
 * before the last class that happened.
 *
 * A group that hasn't started yet keeps the start its plan was laid out from:
 * with nothing taught, a first date still in the future is a decision somebody
 * made in the studio, not a stale guess.
 *
 * Without meeting days there is nowhere to lay the untaught lessons, and their
 * dates are left as they are rather than guessed at.
 */
export function projectDates(
  plan: ClassPlan,
  meetsOn: readonly number[],
  todayKey: string,
): Map<string, string | null> {
  const dates = new Map<string, string | null>();
  const untaught: GroupLessonRow[] = [];

  for (const row of plan.lessons) {
    const taught = plan.taughtOn.get(row.lessonId);
    if (taught) dates.set(row.id, taught);
    else untaught.push(row);
  }

  if (untaught.length === 0 || meetsOn.length === 0) return dates;

  let start = todayKey;
  const lastHeld = [...plan.heldDays].sort().at(-1);
  if (lastHeld && lastHeld >= start) start = addDays(lastHeld, 1);

  if (plan.heldDays.size === 0) {
    const planned = untaught
      .map((row) => row.scheduledOn)
      .filter((date): date is string => !!date)
      .sort()[0];
    if (planned && planned > start) start = planned;
  }

  let cursor = start;
  let placed = 0;
  // Guard, not a limit: a few years of days, so a bad `meetsOn` can't spin.
  for (let i = 0; i < 1500 && placed < untaught.length; i += 1) {
    if (
      meetsOn.includes(fromDateKey(cursor).getDay()) &&
      !plan.cancelled.has(cursor) &&
      !plan.recordedDays.has(cursor)
    ) {
      dates.set(untaught[placed]!.id, cursor);
      placed += 1;
    }
    cursor = addDays(cursor, 1);
  }

  return dates;
}

/**
 * Rewrites the plan's dates to agree with the register. Only rows whose date
 * actually changes are written, so it is cheap to call after every mark and on
 * opening a group — which is also what puts a plan an old "push back" left in a
 * mess right again.
 */
export async function reflowPlan(
  groupId: string,
  meetsOn: readonly number[],
  todayKey: string,
): Promise<ClassPlan> {
  const plan = await loadClassPlan(groupId, meetsOn, todayKey);
  const dates = projectDates(plan, meetsOn, todayKey);

  const changes = plan.lessons.filter(
    (row) => dates.has(row.id) && dates.get(row.id) !== row.scheduledOn,
  );
  await Promise.all(
    changes.map((row) => setGroupLessonDate(row.id, dates.get(row.id) ?? null)),
  );

  return {
    ...plan,
    lessons: plan.lessons.map((row) =>
      dates.has(row.id) ? { ...row, scheduledOn: dates.get(row.id) ?? null } : row,
    ),
  };
}
