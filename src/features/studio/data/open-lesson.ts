// Resolving a lesson id to the document the editor should open.
//
// Deliberately the opposite order to @/features/presenter/use-resolved-lesson,
// which checks the build-time glob first because it is synchronous and a
// projected lesson wants to paint without a loading flash.
//
// An editor cannot afford that shortcut. Saving upserts into the cloud, so
// opening a bundled copy of a lesson that has since been edited and saved would
// quietly overwrite the newer version with the version from the last deploy. The
// cloud is what the save writes to, so the cloud is what the editor opens.

import { getLesson, type Lesson } from "@/lib/lessons";
import { getLocalLesson } from "@/lib/lesson-store";
import { fetchCloudLesson } from "@/lib/lessons-cloud";

/** The document behind a lesson id, or undefined if no source has it. */
export async function openLessonForEditing(
  id: string,
): Promise<Lesson | undefined> {
  const cloud = await fetchCloudLesson(id);
  if (cloud) return cloud;

  // Never saved to the cloud: a lesson bundled into the build, or one opened
  // from a file earlier this session.
  return getLesson(id) ?? getLocalLesson(id);
}
