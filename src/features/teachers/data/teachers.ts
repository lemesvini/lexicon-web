// Admin-side access to the teaching staff.
//
// A teacher has no table of their own: `profiles` is the whole record (see
// supabase/migrations/0006_teachers.sql), and the policy from 0002 already says
// only an admin may read anyone else's row. So listing and deactivating are
// plain PostgREST calls, and only the two things that touch an auth account —
// creating one, and resetting its password — go through Edge Functions.

import { supabase } from "@/lib/supabase";

export type TeacherStatus = "active" | "inactive";

/** One row of the teachers table, flattened for @/components/data-table. */
export type TeacherRow = {
  id: string;
  name: string;
  email: string;
  status: TeacherStatus;
  /** The admin is listed alongside the teachers, but can't be acted on. */
  isAdmin: boolean;
  /** How many students belong to them right now. */
  studentCount: number;
  /** Whether they may use the advanced context studio. */
  advancedStudio: boolean;
  createdAt: string;
};

type TeacherRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  status: string | null;
  advanced_studio: boolean | null;
  created_at: string | null;
};

/**
 * Everyone who can sign in to the teacher app, admins included — the admin row
 * is what makes "who are the students with no teacher of their own" answerable,
 * and leaving it out would make the list look like it was missing someone.
 *
 * The student counts come from a second query rather than an embedded count:
 * PostgREST can only count through a relationship it can see, and `students` is
 * a foreign table to `profiles` in the wrong direction for that.
 */
export async function listTeachers(): Promise<TeacherRow[]> {
  const [{ data, error }, counts] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, role, status, advanced_studio, created_at")
      .in("role", ["admin", "teacher"])
      .order("created_at", { ascending: true }),
    countStudentsByTeacher(),
  ]);

  if (error) throw new Error(error.message);

  return ((data ?? []) as TeacherRecord[]).map((record) => ({
    id: record.id,
    name: record.full_name ?? "",
    email: record.email ?? "",
    status: record.status === "inactive" ? "inactive" : "active",
    isAdmin: record.role === "admin",
    studentCount: counts.get(record.id) ?? 0,
    advancedStudio: record.role === "admin" || record.advanced_studio === true,
    createdAt: record.created_at ?? "",
  }));
}

async function countStudentsByTeacher(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from("students").select("teacher_id");
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.teacher_id as string | null;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export type NewTeacher = {
  fullName: string;
  email: string;
};

/**
 * Creates the teacher's account and returns the temporary password they'll sign
 * in with the first time. Shown once and never stored anywhere readable — if it
 * is lost, the fix is {@link resetTeacherPassword}, not a lookup.
 */
export async function createTeacher(
  input: NewTeacher,
): Promise<{ tempPassword: string }> {
  const { data, error } = await supabase.functions.invoke<{
    tempPassword: string;
  }>("admin-create-teacher", { body: input });

  if (error) throw new Error(await edgeErrorMessage(error));
  if (!data?.tempPassword) throw new Error("The account was not created.");

  return { tempPassword: data.tempPassword };
}

/** Issues a fresh temporary password for a teacher who has lost theirs. */
export async function resetTeacherPassword(
  teacherId: string,
): Promise<{ tempPassword: string }> {
  const { data, error } = await supabase.functions.invoke<{
    tempPassword: string;
  }>("admin-reset-teacher-password", { body: { teacherId } });

  if (error) throw new Error(await edgeErrorMessage(error));
  if (!data?.tempPassword) throw new Error("The password was not reset.");

  return { tempPassword: data.tempPassword };
}

/**
 * Locks a teacher out, or lets them back in. Deliberately not a delete: their
 * students, lessons and corrections all reference them, so the account has to
 * outlive their employment.
 */
export async function setTeacherStatus(
  teacherId: string,
  status: TeacherStatus,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", teacherId);

  if (error) throw new Error(error.message);
}

/** Grants or revokes a teacher's access to the advanced context studio. */
export async function setTeacherAdvancedStudio(
  teacherId: string,
  allowed: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ advanced_studio: allowed })
    .eq("id", teacherId);

  if (error) throw new Error(error.message);
}

/**
 * Pulls the real reason out of a failed function call. supabase-js reports any
 * non-2xx as a flat "Edge Function returned a non-2xx status code" and hides the
 * body on the error's `context` response, so "email already exists" would
 * otherwise never reach the user.
 */
async function edgeErrorMessage(error: unknown): Promise<string> {
  const response = (error as { context?: Response }).context;

  if (response instanceof Response) {
    try {
      const body = (await response.clone().json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // Not JSON — fall through to the generic message.
    }
  }

  return (error as Error).message ?? "Something went wrong.";
}
