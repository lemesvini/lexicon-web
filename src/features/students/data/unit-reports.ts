// Per-unit progress reports: what happened over a unit, and how the test went.
//
// Schema and RLS in supabase/migrations/0010_advanced_context.sql. Staff-only in
// both directions — `teacher_notes` is the teacher's read on a student's test,
// and the student deliberately has no policy granting them a look at it.
//
// These exist for two readers. The teacher, who otherwise carries this in their
// head between terms, and the advanced-context suggestions, for which this is the
// only evidence of how a class is actually doing rather than what it was taught.

import { supabase } from "@/lib/supabase";

export type UnitReport = {
  id: string;
  studentId: string;
  moduleId: string;
  /** The module's name, for display — units are numbered within a module. */
  moduleName: string;
  unit: number;
  observations: string;
  /** 0–10, the same scale as a homework score. Null when no test was recorded. */
  testScore: number | null;
  teacherNotes: string;
  updatedAt: string;
};

type Embedded<T> = T | T[] | null;

function one<T>(embedded: Embedded<T>): T | undefined {
  return Array.isArray(embedded) ? embedded[0] : (embedded ?? undefined);
}

type ReportRecord = {
  id: string;
  student_id: string;
  module_id: string;
  unit: number;
  observations: string | null;
  test_score: number | string | null;
  teacher_notes: string | null;
  updated_at: string;
  module: Embedded<{ name?: string | null }>;
};

/** Every report for one student, oldest unit first — the order they were lived
 *  in, which is the order a run of falling scores reads in. */
export async function listUnitReports(
  studentId: string,
): Promise<UnitReport[]> {
  const { data, error } = await supabase
    .from("student_unit_reports")
    .select(
      "id, student_id, module_id, unit, observations, test_score, teacher_notes, updated_at, module:modules (name)",
    )
    .eq("student_id", studentId)
    .order("unit", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as ReportRecord[]).map((record) => ({
    id: record.id,
    studentId: record.student_id,
    moduleId: record.module_id,
    moduleName: one(record.module)?.name ?? "",
    unit: record.unit,
    observations: record.observations ?? "",
    // PostgREST hands back a `numeric` as a string, so that 12.30 is still 12.30
    // and not whatever the nearest double is. Coerced once, here.
    testScore:
      record.test_score === null ? null : Number(record.test_score),
    teacherNotes: record.teacher_notes ?? "",
    updatedAt: record.updated_at,
  }));
}

export type NewUnitReport = {
  studentId: string;
  moduleId: string;
  unit: number;
  observations: string;
  testScore: number | null;
  teacherNotes: string;
};

/** Writes a report. Upserted on (student, module, unit) — the unique triple from
 *  0010 — so editing last term's entry updates it rather than adding a second. */
export async function saveUnitReport(input: NewUnitReport): Promise<void> {
  const { error } = await supabase.from("student_unit_reports").upsert(
    {
      student_id: input.studentId,
      module_id: input.moduleId,
      unit: input.unit,
      observations: input.observations.trim() || null,
      test_score: input.testScore,
      teacher_notes: input.teacherNotes.trim() || null,
    },
    { onConflict: "student_id,module_id,unit" },
  );

  if (error) throw new Error(error.message);
}

export async function deleteUnitReport(id: string): Promise<void> {
  const { error } = await supabase
    .from("student_unit_reports")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
