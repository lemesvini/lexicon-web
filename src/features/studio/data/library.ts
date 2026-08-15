// The Studio's library: everything the teacher has authored, in the three shapes
// the hub lists it in.
//
// One round trip per table, joined here rather than in the query. There is no
// foreign key from `lessons` to anything PostgREST could count through (the
// module link is by name, and materials/homework are separate tables), and the
// library is small enough that fetching it whole costs less than the
// alternative — the same call the module overview makes, for the same reason.

import { listCloudLessons } from "@/lib/lessons-cloud";
import { listHomework } from "./homework";
import { listMaterials } from "./materials";
import type { PublishStatus } from "./publishing";

export type LibraryLessonRow = {
  id: string;
  title: string;
  unit: string;
  module: string;
  updatedAt: string;
  /** Status of this lesson's student material, or null when it has none yet. */
  materialStatus: PublishStatus | null;
  /** How many homeworks are attached to this lesson, published or not. */
  homeworkCount: number;
};

export type LibraryMaterialRow = {
  lessonId: string;
  /** The lesson's title — a material has none of its own. */
  title: string;
  unit: string;
  module: string;
  status: PublishStatus;
  updatedAt: string;
};

export type LibraryHomeworkRow = {
  id: string;
  title: string;
  status: PublishStatus;
  lessonId: string | null;
  /** Title of the lesson it is attached to, empty while it is unfiled. */
  lessonTitle: string;
  module: string;
  updatedAt: string;
  /**
   * Published and attached, but its lesson's material is not published — so the
   * student has no page for it to appear on. The view deliberately doesn't hide
   * this case (see 0004); surfacing it here is the other half of that decision.
   */
  unreachable: boolean;
};

export type StudioLibrary = {
  lessons: LibraryLessonRow[];
  materials: LibraryMaterialRow[];
  homework: LibraryHomeworkRow[];
  /** Distinct module names in the library, for the tables' module filter. */
  modules: string[];
};

export async function listStudioLibrary(): Promise<StudioLibrary> {
  const [lessons, materials, homework] = await Promise.all([
    listCloudLessons(),
    listMaterials(),
    listHomework(),
  ]);

  const materialByLesson = new Map(materials.map((m) => [m.lessonId, m]));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));

  const homeworkByLesson = new Map<string, number>();
  for (const task of homework) {
    if (!task.lessonId) continue;
    homeworkByLesson.set(
      task.lessonId,
      (homeworkByLesson.get(task.lessonId) ?? 0) + 1,
    );
  }

  const modules = [
    ...new Set(lessons.map((l) => l.module.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  return {
    modules,

    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title || lesson.id,
      unit: lesson.unit,
      module: lesson.module,
      updatedAt: lesson.updatedAt,
      materialStatus: materialByLesson.get(lesson.id)?.status ?? null,
      homeworkCount: homeworkByLesson.get(lesson.id) ?? 0,
    })),

    materials: materials.flatMap((material) => {
      // The FK cascades, so a material without its lesson shouldn't exist. If
      // one somehow does, listing it with no title would be worse than not
      // listing it — the row has nothing to identify it by.
      const lesson = lessonById.get(material.lessonId);
      if (!lesson) return [];
      return [
        {
          lessonId: material.lessonId,
          title: lesson.title || lesson.id,
          unit: lesson.unit,
          module: lesson.module,
          status: material.status,
          updatedAt: material.updatedAt,
        },
      ];
    }),

    homework: homework.map((task) => {
      const lesson = task.lessonId ? lessonById.get(task.lessonId) : undefined;
      const materialStatus = task.lessonId
        ? (materialByLesson.get(task.lessonId)?.status ?? null)
        : null;

      return {
        id: task.id,
        title: task.title || task.id,
        status: task.status,
        lessonId: task.lessonId,
        lessonTitle: lesson ? lesson.title || lesson.id : "",
        module: lesson?.module ?? "",
        updatedAt: task.updatedAt,
        unreachable:
          task.status === "published" &&
          task.lessonId !== null &&
          materialStatus !== "published",
      };
    }),
  };
}
