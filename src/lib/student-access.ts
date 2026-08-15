// What a student is allowed to see, read from their own side.
//
// This is the student's view of their roster row — the admin-facing queries live
// in @/features/students/data/students. RLS (see
// supabase/migrations/0002_students_and_access.sql) already limits the row to
// the caller's own, so there is no filtering to trust the client with here.

import { supabase } from "@/lib/supabase";

export type StudentAccess = {
  id: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
  moduleId: string | null;
  /** Name of the module the student is currently allowed into, if any. */
  moduleName: string | null;
};

/** The signed-in student's roster row, or null if they have none. */
export async function fetchMyStudentAccess(): Promise<StudentAccess | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, email, status, current_module_id, module:modules (name)")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  // PostgREST returns an embedded to-one either as an object or, depending on
  // how it resolves the relationship, as a one-element array.
  const embedded = data.module as { name?: string } | { name?: string }[] | null;
  const module = Array.isArray(embedded) ? embedded[0] : embedded;

  return {
    id: data.id,
    fullName: data.full_name ?? "",
    email: data.email ?? "",
    status: data.status === "inactive" ? "inactive" : "active",
    moduleId: data.current_module_id ?? null,
    moduleName: module?.name ?? null,
  };
}
