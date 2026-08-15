// Admin-side access to the student roster.
//
// Reads and roster edits go straight to Postgres through RLS (admins have full
// access, students see only their own row — see
// supabase/migrations/0002_students_and_access.sql). Anything that touches an
// auth account goes through an Edge Function instead, because that needs the
// service_role key and this app runs entirely in the browser.

import { supabase } from "@/lib/supabase";

export type StudentStatus = "active" | "inactive";

/** A module a student can be placed in. */
export type ModuleOption = {
  id: string;
  name: string;
};

/** One row of the students table, flattened for @/components/data-table. */
export type StudentRow = {
  id: string;
  /** Null until an auth account exists for this student. */
  userId: string | null;
  name: string;
  email: string;
  phone: string;
  status: StudentStatus;
  moduleId: string | null;
  /** Module name, or "—" so the faceted filter has a value to group on. */
  module: string;
  createdAt: string;
};

/** Placeholder used in the module column when a student has none assigned. */
export const NO_MODULE = "—";

type StudentRecord = {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  current_module_id: string | null;
  created_at: string | null;
  module: { name?: string } | { name?: string }[] | null;
};

function toStudentRow(record: StudentRecord): StudentRow {
  // PostgREST returns an embedded to-one either as an object or as a
  // one-element array, depending on how it resolves the relationship.
  const embedded = record.module;
  const module = Array.isArray(embedded) ? embedded[0] : embedded;

  return {
    id: record.id,
    userId: record.user_id,
    name: record.full_name ?? "",
    email: record.email ?? "",
    phone: record.phone ?? "",
    status: record.status === "inactive" ? "inactive" : "active",
    moduleId: record.current_module_id,
    module: module?.name ?? NO_MODULE,
    createdAt: record.created_at ?? "",
  };
}

const SELECT_COLUMNS =
  "id, user_id, full_name, email, phone, status, current_module_id, created_at, module:modules (name)";

/**
 * Every student on the roster, active and inactive alike, newest first. The
 * status filter is a toolbar facet rather than a query parameter — an inactive
 * student should be one click away, not invisible.
 */
export async function listStudents(): Promise<StudentRow[]> {
  const { data, error } = await supabase
    .from("students")
    .select(SELECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as StudentRecord[]).map(toStudentRow);
}

/** The modules a student can be placed in, in curriculum order. */
export async function listModules(): Promise<ModuleOption[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("id, name")
    .eq("is_active", true)
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, name: row.name ?? "" }));
}

export type NewStudent = {
  fullName: string;
  email: string;
  phone?: string;
  currentModuleId?: string | null;
};

/**
 * Creates the roster row *and* the student's auth account, and returns the
 * temporary password they'll sign in with the first time.
 *
 * That password is shown once and never stored anywhere readable — if it's lost,
 * the fix is {@link resetStudentPassword}, not a lookup.
 */
export async function createStudent(
  input: NewStudent,
): Promise<{ tempPassword: string }> {
  const { data, error } = await supabase.functions.invoke<{
    tempPassword: string;
  }>("admin-create-student", { body: input });

  if (error) throw new Error(await edgeErrorMessage(error));
  if (!data?.tempPassword) throw new Error("The account was not created.");

  return { tempPassword: data.tempPassword };
}

/** Issues a fresh temporary password for a student who has lost theirs. */
export async function resetStudentPassword(
  studentId: string,
): Promise<{ tempPassword: string }> {
  const { data, error } = await supabase.functions.invoke<{
    tempPassword: string;
  }>("admin-reset-student-password", { body: { studentId } });

  if (error) throw new Error(await edgeErrorMessage(error));
  if (!data?.tempPassword) throw new Error("The password was not reset.");

  return { tempPassword: data.tempPassword };
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

export async function setStudentStatus(
  studentId: string,
  status: StudentStatus,
): Promise<void> {
  const { error } = await supabase
    .from("students")
    .update({ status })
    .eq("id", studentId);

  if (error) throw new Error(error.message);
}

/**
 * Moves a student to a module, recording it in their history as well as on the
 * roster row. The previous module is marked completed rather than dropped —
 * that trail is the point of `student_modules`.
 */
export async function setCurrentModule(
  studentId: string,
  moduleId: string | null,
): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from("students")
    .select("current_module_id")
    .eq("id", studentId)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const previousModuleId = current?.current_module_id as string | null;
  if (previousModuleId === moduleId) return;

  const { error } = await supabase
    .from("students")
    .update({ current_module_id: moduleId })
    .eq("id", studentId);

  if (error) throw new Error(error.message);

  if (previousModuleId) {
    const { error: completeError } = await supabase
      .from("student_modules")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .eq("module_id", previousModuleId);

    if (completeError) throw new Error(completeError.message);
  }

  if (moduleId) {
    // The student may have been through this module before, so re-entering it
    // reopens the existing history row instead of creating a duplicate.
    const { error: historyError } = await supabase.from("student_modules").upsert(
      {
        student_id: studentId,
        module_id: moduleId,
        status: "in_progress",
        completed_at: null,
      },
      { onConflict: "student_id,module_id" },
    );

    if (historyError) throw new Error(historyError.message);
  }
}
