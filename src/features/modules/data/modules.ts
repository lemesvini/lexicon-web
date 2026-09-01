// Admin-side curriculum management: the modules themselves, and which lessons
// sit in each one.
//
// A lesson's module is `lessons.module`, matched by name against `modules.name`
// — there is no foreign key. Anything that has to keep those two in step (moving
// lessons, renaming a module, deleting one) goes through an RPC rather than a
// table write, because the module also lives inside the lesson's `document` and
// the two must never drift. See supabase/migrations/0003_module_management.sql.

import { supabase } from "@/lib/supabase";
import { listCloudLessons, type CloudLessonSummary } from "@/lib/lessons-cloud";

/** One row of the modules table. */
export type ModuleRow = {
  id: string;
  name: string;
  position: number;
  isActive: boolean;
  /** Whether the homepage's module gallery shows a folder for it (0022). */
  showOnDashboard: boolean;
  /** Lessons currently tagged with this module's name. */
  lessonCount: number;
  /** Students whose current module this is. */
  studentCount: number;
};

/** A lesson as it appears in the assignment dialog. */
export type AssignableLesson = CloudLessonSummary;

/** Module name used for lessons that belong to no module. */
export const UNASSIGNED = "";

/**
 * Every module with its lesson and student counts, in curriculum order.
 *
 * The counts are tallied here rather than in the query: there is no foreign key
 * from `lessons` to `modules` for PostgREST to count through, and the library is
 * small enough that fetching it whole costs less than the alternative.
 */
export async function listModuleOverview(): Promise<{
  modules: ModuleRow[];
  lessons: AssignableLesson[];
}> {
  const [moduleRows, lessons, students] = await Promise.all([
    supabase
      .from("modules")
      .select("id, name, position, is_active, show_on_dashboard")
      .order("position", { ascending: true })
      .order("name", { ascending: true }),
    listCloudLessons(),
    supabase.from("students").select("current_module_id"),
  ]);

  if (moduleRows.error) throw new Error(moduleRows.error.message);
  if (students.error) throw new Error(students.error.message);

  const lessonsByModule = new Map<string, number>();
  for (const lesson of lessons) {
    const name = lesson.module.trim();
    lessonsByModule.set(name, (lessonsByModule.get(name) ?? 0) + 1);
  }

  const studentsByModule = new Map<string, number>();
  for (const row of students.data ?? []) {
    const id = row.current_module_id as string | null;
    if (!id) continue;
    studentsByModule.set(id, (studentsByModule.get(id) ?? 0) + 1);
  }

  const modules: ModuleRow[] = (moduleRows.data ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? "",
    position: row.position ?? 0,
    isActive: row.is_active !== false,
    showOnDashboard: row.show_on_dashboard !== false,
    lessonCount: lessonsByModule.get((row.name ?? "").trim()) ?? 0,
    studentCount: studentsByModule.get(row.id) ?? 0,
  }));

  return { modules, lessons };
}

/**
 * The names a lesson can be filed under, in curriculum order.
 *
 * Names rather than ids because that is what a lesson stores — `lessons.module`
 * is matched against `modules.name`, with no foreign key between them.
 */
export async function listModuleNames(): Promise<string[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("name")
    .eq("is_active", true)
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => (row.name ?? "").trim()).filter(Boolean);
}

/**
 * The modules a teacher has hidden from the homepage's module gallery, by name.
 *
 * Names rather than ids for the same reason as {@link listModuleNames}: what the
 * gallery groups by is `lessons.module`, which is a name.
 */
export async function listDashboardHiddenModules(): Promise<string[]> {
  const { data, error } = await supabase
    .from("modules")
    .select("name")
    .eq("show_on_dashboard", false);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => (row.name ?? "").trim()).filter(Boolean);
}

export async function createModule(
  name: string,
  position: number,
): Promise<void> {
  const { error } = await supabase
    .from("modules")
    .insert({ name: name.trim(), position });

  if (error) {
    // 23505 is a unique violation on `modules.name`.
    throw new Error(
      error.code === "23505"
        ? `There is already a module called “${name.trim()}”.`
        : error.message,
    );
  }
}

/**
 * Renames a module and re-tags every lesson in it, in one transaction. Doing it
 * as two client-side writes would leave a window where the module's students can
 * see nothing at all.
 */
export async function renameModule(
  moduleId: string,
  newName: string,
): Promise<void> {
  const { error } = await supabase.rpc("rename_module", {
    module_id: moduleId,
    new_name: newName.trim(),
  });

  if (error) throw new Error(error.message);
}

export async function setModulePosition(
  moduleId: string,
  position: number,
): Promise<void> {
  const { error } = await supabase
    .from("modules")
    .update({ position })
    .eq("id", moduleId);

  if (error) throw new Error(error.message);
}

/**
 * Hides a module from the roster's picker without touching its lessons or
 * anyone's history. The gentler alternative to {@link deleteModule}.
 */
export async function setModuleActive(
  moduleId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("modules")
    .update({ is_active: isActive })
    .eq("id", moduleId);

  if (error) throw new Error(error.message);
}

/**
 * Shows or hides the module's folder in the homepage's module gallery.
 *
 * Nothing to do with {@link setModuleActive}: an active module is one students
 * can be enrolled into, this is only about what a teacher wants on their own
 * front page. A hidden module still comes back when it is picked by name in the
 * Module filter.
 */
export async function setModuleOnDashboard(
  moduleId: string,
  showOnDashboard: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("modules")
    .update({ show_on_dashboard: showOnDashboard })
    .eq("id", moduleId);

  if (error) throw new Error(error.message);
}

/** Deletes a module and unassigns its lessons. Refused if any student uses it. */
export async function deleteModule(moduleId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_module", {
    module_id: moduleId,
  });

  if (error) throw new Error(error.message);
}

/**
 * Puts a set of lessons into a module, or takes them out of every module when
 * `moduleName` is {@link UNASSIGNED}.
 *
 * A lesson lives in exactly one module — the column holds a single name — so
 * adding a lesson here removes it from wherever it was.
 */
export async function setLessonsModule(
  lessonIds: string[],
  moduleName: string,
): Promise<void> {
  if (lessonIds.length === 0) return;

  const { error } = await supabase.rpc("set_lessons_module", {
    lesson_ids: lessonIds,
    module_name: moduleName,
  });

  if (error) throw new Error(error.message);
}
