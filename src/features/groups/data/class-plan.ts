// What a group has been taught, what comes next, and when the rest is expected.
//
// The classes are the source of truth and the plan's dates follow them — see
// supabase/migrations/0028_group_classes.sql. In short:
//
//   * the plan is a sequence (`group_lessons.position`);
//   * a lesson is taught on the first day a class records it with somebody
//     present — a class nobody came to taught nothing, and needs no undoing;
//   * the next lesson is the one after the lesson of the most recent class with
//     somebody present (`suggestNextLesson`) — not "the first one never taught",
//     so a lesson skipped on purpose stays skipped;
//   * `scheduled_on` is a projection, rewritten by `reflowPlan` after every
//     class saved: taught lessons carry the day they were taught, the next one
//     and those after it are laid on the coming meeting days, skipping cancelled
//     ones.
//
// Nothing here is a one-off operation on the dates. Every write recomputes them
// from the classes, so a mistake in the dates is fixed by fixing the classes.

import type { CloudLessonSummary } from "@/lib/lessons-cloud";
import { supabase } from "@/lib/supabase";

import {
  listGroupClasses,
  suggestNextLesson,
  type GroupClass,
} from "./group-classes";
import {
  listGroupLessons,
  setGroupLessonDate,
  type GroupLessonRow,
} from "./group-lessons";
import { fromDateKey, isMissingSchema, toDateKey } from "./groups";

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

export type ClassPlan = {
  /** The group's copies, in teaching order. */
  lessons: GroupLessonRow[];
  /** Every class, newest first. */
  classes: GroupClass[];
  /** lessonId → the first day it was taught. */
  taughtOn: Map<string, string>;
  /** Days with a class recorded. */
  recordedDays: Set<string>;
  /** Days a class had somebody present — the classes that happened. */
  heldDays: Set<string>;
  cancelled: Set<string>;
  /** The suggested next lesson — see `suggestNextLesson`. */
  next: GroupLessonRow | null;
  /** Past meeting days with no class and no "no class", oldest first. */
  pending: string[];
};

/** One lesson of the course a group is working through, in teaching order. */
export type CourseLesson = {
  lessonId: string;
  title: string;
  unit: string;
  module: string;
};

/**
 * The lessons a class can be for, in the order they are taught.
 *
 * The group's own copies when it has them — that is its plan. A group never
 * given copies falls back on the shared lessons of its module, in curriculum
 * order, and a group with no module on every lesson there is: a class can
 * always be recorded against something.
 */
export function courseLessons(
  planLessons: readonly GroupLessonRow[],
  cloud: readonly CloudLessonSummary[],
  moduleName: string,
): CourseLesson[] {
  if (planLessons.length > 0) {
    return planLessons.map((row) => ({
      lessonId: row.lessonId,
      title: row.title,
      unit: row.unit,
      module: row.module,
    }));
  }
  const inModule = cloud.filter((lesson) => lesson.module === moduleName);
  return (inModule.length > 0 ? inModule : cloud).map((lesson) => ({
    lessonId: lesson.id,
    title: lesson.title,
    unit: lesson.unit,
    module: lesson.module,
  }));
}

function addDays(key: string, days: number): string {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/** The plan as the classes describe it. Pure, so it can be reasoned about (and
 *  recomputed) without a round trip. */
export function buildPlan(
  lessons: GroupLessonRow[],
  classes: GroupClass[],
  cancelled: Set<string>,
  meetsOn: readonly number[],
  todayKey: string,
): ClassPlan {
  const ordered = [...lessons].sort((a, b) => a.position - b.position);

  const recordedDays = new Set<string>();
  const heldDays = new Set<string>();
  const taughtOn = new Map<string, string>();

  // Oldest first, so the first day a lesson is seen held is the day it was
  // taught.
  for (const entry of [...classes].reverse()) {
    recordedDays.add(entry.classDate);
    if (entry.present === 0) continue;
    heldDays.add(entry.classDate);
    if (entry.lessonId && !taughtOn.has(entry.lessonId)) {
      taughtOn.set(entry.lessonId, entry.classDate);
    }
  }

  const nextId = suggestNextLesson(
    ordered.map((row) => row.lessonId),
    classes,
  );
  const next = ordered.find((row) => row.lessonId === nextId) ?? null;

  // A meeting day nothing was recorded for. Only from the first class on —
  // before it the group hadn't started — and only recently.
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
    classes,
    taughtOn,
    recordedDays,
    heldDays,
    cancelled,
    next,
    pending,
  };
}

export async function loadClassPlan(
  groupId: string,
  meetsOn: readonly number[],
  todayKey: string,
): Promise<ClassPlan> {
  const [lessons, classes, cancelled] = await Promise.all([
    listGroupLessons(groupId),
    listGroupClasses(groupId),
    listCancelledClasses(groupId),
  ]);
  return buildPlan(lessons, classes, cancelled, meetsOn, todayKey);
}

/**
 * The dates every copy should carry, given the classes.
 *
 * Taught lessons keep the day they were taught. The next lesson and every
 * untaught one after it go, in order, onto the meeting days from today on —
 * skipping any day already recorded or marked as no class, and never before the
 * last class that happened. Untaught lessons *before* the next one were skipped,
 * and lose their date: a skipped lesson isn't expected on any day.
 *
 * A group that hasn't started yet keeps the start its plan was laid out from:
 * with nothing taught, a first date still in the future is a decision somebody
 * made in the studio, not a stale guess.
 *
 * Without meeting days there is nowhere to lay the coming lessons, and their
 * dates are left as they are rather than guessed at.
 */
export function projectDates(
  plan: ClassPlan,
  meetsOn: readonly number[],
  todayKey: string,
): Map<string, string | null> {
  const dates = new Map<string, string | null>();
  const coming: GroupLessonRow[] = [];
  const nextIndex = plan.next ? plan.lessons.indexOf(plan.next) : -1;

  plan.lessons.forEach((row, index) => {
    const taught = plan.taughtOn.get(row.lessonId);
    if (taught) dates.set(row.id, taught);
    else if (nextIndex !== -1 && index >= nextIndex) coming.push(row);
    else dates.set(row.id, null);
  });

  if (coming.length === 0 || meetsOn.length === 0) return dates;

  let start = todayKey;
  const lastHeld = [...plan.heldDays].sort().at(-1);
  if (lastHeld && lastHeld >= start) start = addDays(lastHeld, 1);

  if (plan.heldDays.size === 0) {
    const planned = coming
      .map((row) => row.scheduledOn)
      .filter((date): date is string => !!date)
      .sort()[0];
    if (planned && planned > start) start = planned;
  }

  let cursor = start;
  let placed = 0;
  // Guard, not a limit: a few years of days, so a bad `meetsOn` can't spin.
  for (let i = 0; i < 1500 && placed < coming.length; i += 1) {
    if (
      meetsOn.includes(fromDateKey(cursor).getDay()) &&
      !plan.cancelled.has(cursor) &&
      !plan.recordedDays.has(cursor)
    ) {
      dates.set(coming[placed]!.id, cursor);
      placed += 1;
    }
    cursor = addDays(cursor, 1);
  }

  return dates;
}

/**
 * Rewrites the plan's dates to agree with the classes. Only rows whose date
 * actually changes are written, so it is cheap to call after every save and on
 * opening a group.
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
